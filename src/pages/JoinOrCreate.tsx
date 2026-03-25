import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, Users, ArrowLeft, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const JoinOrCreate = () => {
  const { session, loading: authLoading } = useAuth();
  const { familyId, isLoading: familyLoading } = useFamilyId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // QR scanner refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect to auth if no session
  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, session, navigate]);

  // If user already has a family, set flag and go home
  useEffect(() => {
    if (familyId) {
      localStorage.setItem("join_or_create_done", "true");
      navigate("/", { replace: true });
    }
  }, [familyId, navigate]);

  const handleJoin = async (inviteCode: string) => {
    if (!inviteCode.trim() || joining) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "join", invite_code: inviteCode.trim(), role: "son" },
      });
      if (error || data?.error) {
        const msg = data?.error || "فشل الانضمام";
        if (msg.includes("عضو بالفعل")) {
          localStorage.setItem("join_or_create_done", "true");
          queryClient.invalidateQueries({ queryKey: ["family-id"] });
          toast({ title: "أنت عضو بالفعل في هذه العائلة" });
          navigate("/", { replace: true });
          return;
        }
        toast({ title: msg, variant: "destructive" });
      } else {
        localStorage.setItem("join_or_create_done", "true");
        queryClient.invalidateQueries({ queryKey: ["family-id"] });
        queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
        toast({ title: "تم الانضمام بنجاح! 🎉" });
        navigate("/", { replace: true });
      }
    } catch {
      toast({ title: "حدث خطأ غير متوقع", variant: "destructive" });
    } finally {
      setJoining(false);
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
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              if (rawValue) {
                stopScanner();
                setShowScanner(false);
                // Extract code — could be raw code or legacy URL
                const extracted = rawValue.includes("code=")
                  ? new URL(rawValue).searchParams.get("code") || rawValue
                  : rawValue;
                setCode(extracted);
                handleJoin(extracted);
              }
            }
          } catch {}
        }, 500);
      }
    } catch {
      toast({ title: "لا يمكن الوصول للكاميرا", variant: "destructive" });
      setShowScanner(false);
    }
  }, [stopScanner]);

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
          <h1 className="text-3xl font-bold text-primary-foreground mb-1">انضم لعائلتك</h1>
          <p className="text-primary-foreground/70 text-sm">أدخل كود الدعوة أو امسح رمز QR</p>
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

        {/* Code input */}
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
            onClick={() => handleJoin(code)}
            disabled={code.length < 8 || joining}
            className="w-full py-3.5 rounded-xl text-base font-semibold text-primary-foreground bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : "انضمام"}
          </button>

          {/* QR scan button */}
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

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="w-full py-3 rounded-xl text-sm font-semibold text-muted-foreground transition-colors active:bg-muted/50"
        >
          تخطي وإنشاء عائلتي لاحقاً
          <ArrowLeft size={14} className="inline mr-1" />
        </button>

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
