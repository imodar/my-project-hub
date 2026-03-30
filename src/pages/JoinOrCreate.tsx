import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";
import { ScanLine, Users, ArrowLeft, Loader2, User, Heart, Baby, Crown, ShieldCheck, Clock, X, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

type CreateRole = "father" | "mother" | "son" | "daughter";

const ROLE_INFO: Record<CreateRole, { label: string; icon: typeof User; iconColor: string; bgColor: string }> = {
  father: { label: "أب", icon: User, iconColor: "text-primary", bgColor: "hsl(var(--primary) / 0.15)" },
  mother: { label: "أم", icon: Heart, iconColor: "text-primary", bgColor: "hsl(var(--primary) / 0.15)" },
  son: { label: "ابن", icon: Baby, iconColor: "text-blue-500", bgColor: "hsl(200, 60%, 92%)" },
  daughter: { label: "ابنة", icon: Baby, iconColor: "text-pink-500", bgColor: "hsl(340, 60%, 92%)" },
};

const JoinOrCreate = () => {
  const { session, loading: authLoading } = useAuth();
  const { familyId, pendingFamilyId, isLoading: familyLoading } = useFamilyId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Read ?code= from URL (e.g. from QR scan)
  const urlCode = searchParams.get("code") || "";

  const [code, setCode] = useState(urlCode);
  const [joining, setJoining] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createRole, setCreateRole] = useState<CreateRole | null>(null);
  const [creating, setCreating] = useState(false);

  // Join status: idle → pending → accepted/rejected
  const [joinStatus, setJoinStatus] = useState<"idle" | "pending" | "accepted" | "rejected">("idle");
  const [pendingJoinFamilyId, setPendingJoinFamilyId] = useState<string | null>(null);

  // QR scanner refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (familyId) {
      localStorage.setItem("join_or_create_done", "true");
      navigate("/", { replace: true });
    }
  }, [familyId, navigate]);

  // If user has a pending family from a previous session, show pending UI
  useEffect(() => {
    if (pendingFamilyId && joinStatus === "idle") {
      setPendingJoinFamilyId(pendingFamilyId);
      setJoinStatus("pending");
    }
  }, [pendingFamilyId, joinStatus]);

  const handleJoin = async () => {
    if (!code.trim() || joining) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "join", invite_code: code.trim() },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "فشل الانضمام — تحقق من الكود وحاول مرة أخرى";
        if (msg.includes("طلبك قيد الانتظار")) {
          setJoinStatus("pending");
          return;
        }
        if (msg.includes("عضو بالفعل")) {
          localStorage.setItem("join_or_create_done", "true");
          queryClient.invalidateQueries({ queryKey: ["family-id"] });
          appToast.success("أنت عضو بالفعل في هذه العائلة");
          navigate("/", { replace: true });
          return;
        }
        appToast.error(msg);
      } else {
        setPendingJoinFamilyId(data?.data?.family_id);
        setJoinStatus("pending");
      }
    } catch {
      appToast.error("حدث خطأ غير متوقع");
    } finally {
      setJoining(false);
    }
  };

  // Realtime listener — wait for admin to accept/reject
  useEffect(() => {
    if (joinStatus !== "pending" || !session?.user?.id) return;

    const channel = supabase
      .channel(`join-status-${session.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "family_members",
        filter: `user_id=eq.${session.user.id}`,
      }, (payload: any) => {
        const newStatus = payload.new?.status;
        if (newStatus === "active") {
          setJoinStatus("accepted");
          localStorage.setItem("join_or_create_done", "true");
          queryClient.invalidateQueries({ queryKey: ["family-id"] });
          setTimeout(() => navigate("/", { replace: true }), 1500);
        }
        if (payload.eventType === "DELETE") {
          setJoinStatus("rejected");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [joinStatus, session?.user?.id, queryClient, navigate]);

  const handleCreateFamily = async () => {
    if (!createRole || creating) return;
    setCreating(true);
    try {
      const profileName = session?.user?.id
        ? localStorage.getItem(`profile_name_${session.user.id}`) || "عائلتي"
        : "عائلتي";
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "create", name: profileName, role: createRole },
      });
      if (error || data?.error) {
        appToast.error(data?.error || "فشل إنشاء الأسرة");
      } else {
        localStorage.setItem("join_or_create_done", "true");
        queryClient.invalidateQueries({ queryKey: ["family-id"] });
        queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
        appToast.success("تم إنشاء الأسرة بنجاح! 🎉");
        navigate("/", { replace: true });
      }
    } catch {
      appToast.error("حدث خطأ غير متوقع");
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("join_or_create_done", "true");
    navigate("/", { replace: true });
  };

  // QR Scanner
  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((t) => t.stop());
      scanStreamRef.current = null;
    }
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleQrResult = useCallback((rawValue: string) => {
    stopScanner();
    setShowScanner(false);
    const extracted = rawValue.includes("code=")
      ? new URL(rawValue).searchParams.get("code") || rawValue
      : rawValue;
    setCode(extracted);
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      scanStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const useBarcodeDetector = "BarcodeDetector" in window;

      if (useBarcodeDetector) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleQrResult(barcodes[0].rawValue);
            }
          } catch {}
        }, 500);
      } else {
        // jsQR fallback
        scanIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || video.readyState < 2 || !canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imageData.data, canvas.width, canvas.height);
          if (qr?.data) {
            handleQrResult(qr.data);
          }
        }, 400);
      }
    } catch {
      appToast.error("لا يمكن الوصول للكاميرا");
      setShowScanner(false);
    }
  }, [stopScanner, handleQrResult]);

  useEffect(() => {
    if (showScanner) startScanner();
    else stopScanner();
    return () => stopScanner();
  }, [showScanner, startScanner, stopScanner]);

  if (authLoading || familyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pending state — waiting for admin approval
  if (joinStatus === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock size={36} className="text-primary animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-foreground">بانتظار موافقة المشرف</h2>
          <p className="text-sm text-muted-foreground">
            تم إرسال طلبك — سيتلقى مشرف العائلة إشعاراً ويقوم بتحديد دورك
          </p>
          <p className="text-xs text-muted-foreground/60">سيتم تحديث الصفحة تلقائياً عند القبول</p>
        </div>
      </div>
    );
  }

  // Rejected state
  if (joinStatus === "rejected") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <X size={36} className="text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">تم رفض الطلب</h2>
          <p className="text-sm text-muted-foreground">تعذّر قبول انضمامك — تواصل مع مشرف العائلة</p>
          <button
            onClick={() => { setJoinStatus("idle"); setCode(""); }}
            className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            حاول مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  // Accepted state
  if (joinStatus === "accepted") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <Check size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">تم القبول! 🎉</h2>
          <p className="text-sm text-muted-foreground">جاري الدخول للتطبيق...</p>
        </div>
      </div>
    );
  }

  const isParentRole = createRole === "father" || createRole === "mother";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary via-primary/90 to-primary/70" dir="rtl">
      {/* Top branding */}
      <div className="h-[30vh] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary-foreground/20">
            <Users size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-1">
            {showCreate ? "إنشاء عائلتك" : "انضم لعائلتك"}
          </h1>
          <p className="text-primary-foreground/70 text-sm">
            {showCreate ? "اختر دورك في الأسرة" : "أدخل كود الدعوة أو امسح رمز QR"}
          </p>
        </motion.div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="bg-background rounded-t-[2rem] px-6 pt-8 pb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] min-h-[70vh] flex flex-col"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-6" />

        {/* Join section — animated out when showCreate */}
        <div
          className={`transition-all duration-300 ${
            showCreate ? "opacity-0 -translate-y-5 pointer-events-none h-0 overflow-hidden" : "opacity-100 translate-y-0"
          }`}
        >
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-foreground">كود الانضمام</h2>
              <p className="text-sm text-muted-foreground mt-1">اطلب الكود من مشرف الأسرة</p>
            </div>

            <div className="flex gap-2" dir="ltr">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="أدخل الكود"
                className="flex-1 px-4 py-3.5 rounded-xl text-center text-base font-bold tracking-widest border border-input bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={8}
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={code.length < 8 || joining}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-primary-foreground bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : "انضمام"}
            </button>

            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold text-primary border-2 border-primary/20 transition-colors active:bg-primary/5"
            >
              <ScanLine size={20} />
              مسح رمز QR
            </button>
          </div>

          {/* Divider */}
          <div className="relative py-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">أو</span>
            </div>
          </div>
        </div>

        {/* Create family section — animated in */}
        <div
          className={`transition-all duration-300 ${
            showCreate ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 pointer-events-none h-0 overflow-hidden"
          }`}
          style={{ transitionDelay: showCreate ? "150ms" : "0ms" }}
        >
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-foreground">اختر دورك في الأسرة</h2>
            <p className="text-sm text-muted-foreground mt-1">سيتم إنشاء مجموعتك العائلية</p>
          </div>

          {/* Role grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {(["father", "mother", "son", "daughter"] as CreateRole[]).map((role) => {
              const info = ROLE_INFO[role];
              const Icon = info.icon;
              const selected = createRole === role;
              return (
                <button
                  key={role}
                  onClick={() => setCreateRole(role)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    selected ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: info.bgColor }}
                  >
                    <Icon size={22} className={info.iconColor} />
                  </div>
                  <span className="text-sm font-bold text-foreground">{info.label}</span>
                </button>
              );
            })}
          </div>

          {/* Info card — slides in after role selected */}
          <div
            className={`transition-all duration-200 overflow-hidden ${
              createRole ? "opacity-100 max-h-40" : "opacity-0 max-h-0"
            }`}
          >
            <div className="bg-muted/50 rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground text-center leading-relaxed flex items-center justify-center gap-1">
                {isParentRole ? (
                  <>
                    <Crown size={12} className="text-primary shrink-0" />
                    ستكون المشرف الرئيسي على العائلة. عند انضمام أب أو أم لاحقاً، سيحصلان على صلاحيات الإشراف تلقائياً.
                  </>
                ) : (
                  <>
                    <ShieldCheck size={12} className="text-primary shrink-0" />
                    ستكون المشرف المؤقت على العائلة حتى ينضم أحد الوالدين. عندها سيكون لهم خيار إبقاء إشرافك أو تغييره.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreateFamily}
            disabled={!createRole || creating}
            className="w-full py-3.5 rounded-xl text-base font-semibold text-primary-foreground bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "إنشاء العائلة"}
          </button>

          {/* Back to join */}
          <button
            onClick={() => { setShowCreate(false); setCreateRole(null); }}
            className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors active:bg-muted/50"
          >
            العودة للانضمام بكود
            <ArrowLeft size={14} className="inline mr-1" />
          </button>
        </div>

        {/* Show "Create family" button or Skip when in join mode */}
        {!showCreate && (
          <>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-primary border-2 border-primary/20 transition-colors active:bg-primary/5 flex items-center justify-center gap-2"
            >
              إنشاء عائلتي
            </button>

            <button
              onClick={handleSkip}
              className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors active:bg-muted/50"
            >
              تخطي وإنشاء عائلتي لاحقاً
              <ArrowLeft size={14} className="inline mr-1" />
            </button>
          </>
        )}

        <div className="flex-1" />

        <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed pt-4">
          يمكنك الانضمام لعائلة أو إنشاء واحدة جديدة من صفحة "إدارة الأسرة"
        </p>
      </motion.div>

      {/* QR Scanner Drawer */}
      <Drawer open={showScanner} onOpenChange={(open) => { if (!open) { setShowScanner(false); } }}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">مسح رمز QR</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 mt-2">
            <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-2xl overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-primary rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute inset-x-2 h-0.5 bg-primary/80 animate-bounce" style={{ top: "50%" }} />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">وجّه الكاميرا نحو رمز QR الخاص بالعائلة</p>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default JoinOrCreate;
