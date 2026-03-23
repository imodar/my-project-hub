import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, QrCode, Copy, Link2, Check, UserPlus, Trash2, Share2, Crown, User, Baby, ShieldCheck, Heart, Clock, Shield, Briefcase, Car, ScanLine, X, RefreshCw } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyId } from "@/hooks/useFamilyId";

type FamilyRole = "father" | "mother" | "son" | "daughter" | "husband" | "wife" | "worker" | "maid" | "driver";
type InviteStatus = "active" | "pending";

interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
  isCreator?: boolean;
  isAdmin?: boolean;
  status: InviteStatus;
  avatar?: string;
}

const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const ROLE_LABELS: Record<string, string> = {
  father: "الأب",
  mother: "الأم",
  son: "ابن",
  daughter: "ابنة",
  husband: "الزوج",
  wife: "الزوجة",
  worker: "عامل",
  maid: "عاملة",
  driver: "سائق",
};

const isStaffRole = (role: FamilyRole) =>
  role === "worker" || role === "maid" || role === "driver";

const RoleIcon = ({ role, size = 20, className = "" }: { role: string; size?: number; className?: string }) => {
  switch (role) {
    case "father":
    case "husband":
      return <User size={size} className={className} />;
    case "mother":
    case "wife":
      return <Heart size={size} className={className} />;
    case "son":
    case "daughter":
      return <Baby size={size} className={className} />;
    case "worker":
    case "maid":
      return <Briefcase size={size} className={className} />;
    case "driver":
      return <Car size={size} className={className} />;
    default:
      return <User size={size} className={className} />;
  }
};

const isParentRole = (role: FamilyRole) =>
  role === "father" || role === "mother" || role === "husband" || role === "wife";

const SWIPE_THRESHOLD = 40;
const SWIPE_WIDTH = 144; // wider for 2 buttons

const getProfileName = (): string => {
  return "";
};

const FamilyManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.name) setProfileName(data.name);
      });
  }, [user]);

  const [creatorRole, setCreatorRole] = useState<FamilyRole | null>(() => {
    const saved = localStorage.getItem("family_creator_role");
    return saved as FamilyRole | null;
  });

  const [members, setMembers] = useState<FamilyMember[]>(() => {
    const saved = localStorage.getItem("family_members");
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupRole, setSetupRole] = useState<"father" | "mother" | "son" | "daughter" | null>(null);

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Approval dialog state - when someone scans QR / enters code
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalName, setApprovalName] = useState("");
  const [approvalRole, setApprovalRole] = useState<FamilyRole | null>(null);

  useEffect(() => {
    if (!creatorRole && members.length === 0) {
      setShowSetupDialog(true);
    }
  }, [creatorRole, members.length]);

  useEffect(() => {
    localStorage.setItem("family_members", JSON.stringify(members));
  }, [members]);

  const handleSetupComplete = () => {
    if (!setupRole) return;
    const role = setupRole;
    setCreatorRole(role);
    localStorage.setItem("family_creator_role", role);
    const creator: FamilyMember = {
      id: "creator",
      name: profileName,
      role,
      isCreator: true,
      isAdmin: isParentRole(role),
      status: "active",
    };
    setMembers([creator]);
    setShowSetupDialog(false);
    toast({ title: "تم إنشاء الأسرة بنجاح!" });
  };

  // Add member dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addStep, setAddStep] = useState<"choose-type" | "enter-name" | "invite-method">("choose-type");
  const [selectedType, setSelectedType] = useState<FamilyRole | null>(null);
  const [newName, setNewName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeTimer, setCodeTimer] = useState(300);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  // Swipe state
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const isDragging = useRef(false);

  // Fetch invite code from server on mount
  const fetchInviteCode = useCallback(async () => {
    if (!familyId) return;
    const { data } = await supabase.functions.invoke("family-management", {
      body: { action: "get-invite-code", family_id: familyId },
    });
    if (data?.data?.invite_code) {
      setInviteCode(data.data.invite_code);
    }
  }, [familyId]);

  const regenerateCode = useCallback(async () => {
    if (!familyId || isRegeneratingCode) return;
    setIsRegeneratingCode(true);
    try {
      const { data } = await supabase.functions.invoke("family-management", {
        body: { action: "regenerate-code", family_id: familyId },
      });
      if (data?.data?.invite_code) {
        setInviteCode(data.data.invite_code);
        setCodeTimer(300);
      }
    } catch {
      toast({ title: "فشل تجديد الكود", variant: "destructive" });
    } finally {
      setIsRegeneratingCode(false);
    }
  }, [familyId, isRegeneratingCode]);

  // Fetch code when family is ready
  useEffect(() => {
    if (familyId && creatorRole) {
      fetchInviteCode();
    }
  }, [familyId, creatorRole, fetchInviteCode]);

  // Countdown timer - always runs when we have a code
  useEffect(() => {
    if (!inviteCode || !creatorRole) return;
    const interval = setInterval(() => {
      setCodeTimer((t) => {
        if (t <= 1) {
          regenerateCode();
          return 300;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [inviteCode, creatorRole, regenerateCode]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const hasSpouse = members.some((m) =>
    m.role === "wife" || m.role === "husband" ||
    (creatorRole === "father" && m.role === "mother") ||
    (creatorRole === "mother" && m.role === "father")
  );

  const getSpouseRole = (): FamilyRole | null => {
    if (hasSpouse) return null;
    if (creatorRole === "father") return "wife";
    if (creatorRole === "mother") return "husband";
    return null;
  };

  const handleAddMember = () => {
    if (!selectedType || !newName.trim()) return;
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: newName.trim(),
      role: selectedType,
      isAdmin: isParentRole(selectedType),
      status: "pending",
    };
    setMembers((prev) => [...prev, newMember]);
    setAddStep("invite-method");
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setOpenSwipeId(null);
    setSwipeOffsets({});
    toast({ title: "تم حذف الفرد من الأسرة" });
  };

  const handleToggleAdmin = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        // Parents can't lose admin
        if (isParentRole(m.role)) {
          toast({ title: "لا يمكن إلغاء إشراف الوالدين", variant: "destructive" });
          return m;
        }
        const newAdmin = !m.isAdmin;
        toast({ title: newAdmin ? `تم تعيين ${m.name} كمشرف` : `تم إلغاء إشراف ${m.name}` });
        return { ...m, isAdmin: newAdmin };
      })
    );
    setOpenSwipeId(null);
    setSwipeOffsets({});
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({ title: "تم نسخ الكود" });
  };

  const handleCopyLink = () => {
    const link = `https://app.example.com/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: "تم نسخ رابط الدعوة" });
  };

  const handleShareLink = async () => {
    const link = `https://app.example.com/join/${inviteCode}`;
    if (navigator.share) {
      await navigator.share({ title: "دعوة انضمام للأسرة", url: link });
    } else {
      handleCopyLink();
    }
  };

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

      // Use BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                stopScanner();
                setShowScanner(false);
                setJoinCode(code);
                // Auto-submit join request
                handleJoinByCode(code);
              }
            }
          } catch {}
        }, 500);
      }
    } catch {
      toast({ title: "لا يمكن الوصول للكاميرا", variant: "destructive" });
      setShowScanner(false);
    }
  }, []);

  const handleJoinByCode = async (code: string) => {
    if (!code.trim()) return;
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "join", invite_code: code.trim(), role: "son" },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل الانضمام", variant: "destructive" });
      } else {
        toast({ title: "تم إرسال طلب الانضمام بنجاح!" });
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleManualJoin = () => {
    if (!joinCode.trim()) return;
    handleJoinByCode(joinCode);
    setShowScanner(false);
    setJoinCode("");
  };

  useEffect(() => {
    if (showScanner) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [showScanner, startScanner, stopScanner]);

  const resetDialog = () => {
    setShowAddDialog(false);
    setAddStep("choose-type");
    setSelectedType(null);
    setNewName("");
  };

  // Simulate incoming join request (for demo - triggered by button)
  const simulateJoinRequest = () => {
    setApprovalName("محمد");
    setApprovalRole(null);
    setShowApprovalDialog(true);
  };

  const handleApproveJoin = () => {
    if (!approvalRole || !approvalName.trim()) return;
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: approvalName.trim(),
      role: approvalRole,
      isAdmin: isParentRole(approvalRole),
      status: "active",
    };
    setMembers((prev) => [...prev, newMember]);
    setShowApprovalDialog(false);
    setApprovalName("");
    setApprovalRole(null);
    toast({ title: `تم قبول ${newMember.name} في الأسرة!` });
  };

  // Swipe handlers (touch + mouse)
  const handlePointerStart = useCallback((x: number, y: number, id: string) => {
    touchStartRef.current = { x, y, id };
    isDragging.current = false;
  }, []);

  const handlePointerMove = useCallback((x: number, y: number, id: string) => {
    if (!touchStartRef.current || touchStartRef.current.id !== id) return;
    const dx = x - touchStartRef.current.x;
    const dy = Math.abs(touchStartRef.current.y - y);

    if (!isDragging.current && dy > Math.abs(dx)) {
      touchStartRef.current = null;
      return;
    }
    isDragging.current = true;

    if (dx > 0) {
      const offset = Math.min(dx, SWIPE_WIDTH);
      setSwipeOffsets((prev) => ({ ...prev, [id]: offset }));
    } else {
      setSwipeOffsets((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + dx * 0.5) }));
    }
  }, []);

  const handlePointerEnd = useCallback((id: string) => {
    const offset = swipeOffsets[id] || 0;
    if (offset > SWIPE_THRESHOLD) {
      setSwipeOffsets((prev) => ({ ...prev, [id]: SWIPE_WIDTH }));
      setOpenSwipeId(id);
    } else {
      setSwipeOffsets((prev) => ({ ...prev, [id]: 0 }));
      setOpenSwipeId(null);
    }
    touchStartRef.current = null;
    isDragging.current = false;
  }, [swipeOffsets]);

  // Mouse drag state
  const mouseDownRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    mouseDownRef.current = true;
    handlePointerStart(e.clientX, e.clientY, id);
  }, [handlePointerStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent, id: string) => {
    if (!mouseDownRef.current) return;
    e.preventDefault();
    handlePointerMove(e.clientX, e.clientY, id);
  }, [handlePointerMove]);

  const handleMouseUp = useCallback((id: string) => {
    if (!mouseDownRef.current) return;
    mouseDownRef.current = false;
    handlePointerEnd(id);
  }, [handlePointerEnd]);

  const handleCardTap = useCallback((id: string) => {
    if (openSwipeId && openSwipeId !== id) {
      setSwipeOffsets((prev) => ({ ...prev, [openSwipeId]: 0 }));
      setOpenSwipeId(null);
    }
  }, [openSwipeId]);

  const spouseRole = getSpouseRole();

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-semibold text-primary"
          style={{ background: "hsl(var(--primary) / 0.1)" }}
        >
          <ScanLine size={16} />
          مسح QR
        </button>
        <h1 className="text-lg font-bold text-foreground">إدارة أفراد الأسرة</h1>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground bg-muted/50">
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Members List */}
      <div className="flex-1 px-4 pb-8">
        <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">أفراد الأسرة ({members.length})</h2>
        <div className="space-y-2">
          {members.map((member) => {
            const offset = swipeOffsets[member.id] || 0;
            const memberIsAdmin = member.isAdmin || isParentRole(member.role);
            const canSwipe = !member.isCreator;
            const isPending = member.status === "pending";
            return (
              <div key={member.id} className="relative overflow-hidden rounded-2xl" onClick={() => handleCardTap(member.id)}>
                {/* Swipe actions - Delete + Admin */}
                {canSwipe && (
                  <div
                    className="absolute inset-y-0 left-0 flex items-center gap-1 p-1"
                    style={{ width: `${SWIPE_WIDTH}px` }}
                  >
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl text-destructive-foreground"
                      style={{ background: "hsl(var(--destructive))" }}
                    >
                      <Trash2 size={16} />
                      <span className="text-[10px] font-semibold">حذف</span>
                    </button>
                    <button
                      onClick={() => handleToggleAdmin(member.id)}
                      className="flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl text-primary-foreground"
                      style={{ background: memberIsAdmin ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))" }}
                    >
                      <Shield size={16} />
                      <span className="text-[10px] font-semibold">{memberIsAdmin ? "إلغاء" : "مشرف"}</span>
                    </button>
                  </div>
                )}

                {/* Card */}
                <div
                  className="relative flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl transition-transform duration-150"
                  style={{
                    boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
                    transform: `translateX(${offset}px)`,
                  }}
                  onTouchStart={(e) => canSwipe && handlePointerStart(e.touches[0].clientX, e.touches[0].clientY, member.id)}
                  onTouchMove={(e) => canSwipe && handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, member.id)}
                  onTouchEnd={() => canSwipe && handlePointerEnd(member.id)}
                  onMouseDown={(e) => canSwipe && handleMouseDown(e, member.id)}
                  onMouseMove={(e) => canSwipe && handleMouseMove(e, member.id)}
                  onMouseUp={() => canSwipe && handleMouseUp(member.id)}
                  onMouseLeave={() => canSwipe && mouseDownRef.current && handleMouseUp(member.id)}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{
                    background: memberIsAdmin ? "hsl(var(--primary) / 0.15)" : "hsl(var(--accent) / 0.15)",
                    opacity: isPending ? 0.5 : 1,
                  }}>
                    <RoleIcon role={member.role} size={20} className={memberIsAdmin ? "text-primary" : "text-accent-foreground"} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className={`text-sm font-semibold ${isPending ? "text-muted-foreground" : "text-foreground"}`}>{member.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</p>
                    {isPending && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mt-0.5">
                        <Clock size={8} />
                        بانتظار القبول
                      </span>
                    )}
                  </div>
                  {memberIsAdmin && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
                      <Crown size={10} />
                      مشرف
                    </span>
                  )}
                  {member.isCreator && (
                    <span className="text-[10px] px-2 py-1 rounded-full font-semibold bg-accent text-accent-foreground">
                      المؤسس
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add button */}
        {creatorRole && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-semibold text-primary transition-colors active:bg-primary/10"
            style={{
              background: "hsl(var(--primary) / 0.08)",
              border: "2px dashed hsl(var(--primary) / 0.3)",
            }}
          >
            <Plus size={18} />
            إضافة فرد جديد
          </button>
        )}

        {/* Invite section */}
        {creatorRole && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">طرق الانضمام</h2>
            <div className="space-y-3">
              {/* QR Code */}
              <div className="rounded-2xl p-4 text-center bg-card" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <QrCode size={18} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">رمز QR</span>
                </div>
                <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center mb-3 bg-muted border-2 border-border">
                  <div className="grid grid-cols-5 gap-1">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className="w-5 h-5 rounded-sm" style={{
                        background: Math.random() > 0.4 ? "hsl(var(--foreground))" : "transparent",
                      }} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">امسح الرمز للانضمام للأسرة</p>
                <p className="text-[10px] text-muted-foreground/70">عند مسح الرمز، ستظهر شاشة قبول على جهاز المشرف لاختيار دور العضو الجديد</p>
              </div>

              {/* Simulate join request button (for demo) */}
              <button
                onClick={simulateJoinRequest}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-foreground bg-card transition-colors active:bg-muted"
                style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)", border: "1px dashed hsl(var(--border))" }}
              >
                <UserPlus size={16} className="text-primary" />
                محاكاة طلب انضمام (للتجربة)
              </button>

              {/* Invite Code */}
              <div className="rounded-2xl p-4 bg-card" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">ينتهي خلال {formatTime(codeTimer)}</span>
                    <button
                      onClick={regenerateCode}
                      disabled={isRegeneratingCode}
                      className="p-1 rounded-full transition-colors active:bg-muted"
                    >
                      <RefreshCw size={14} className={`text-muted-foreground ${isRegeneratingCode ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-foreground">كود الانضمام</span>
                </div>
                {/* Timer progress bar */}
                <div className="w-full h-1 rounded-full bg-muted mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${(codeTimer / 300) * 100}%`,
                      background: codeTimer < 60 ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                    }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex gap-1.5" style={{ direction: "ltr" }}>
                    {(inviteCode || "--------").split("").map((char, i) => (
                      <div key={i} className="w-9 h-11 rounded-xl flex items-center justify-center text-base font-bold text-foreground bg-muted border border-border">
                        {isRegeneratingCode ? "·" : char}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/70 text-center mb-2">كود فريد يتجدد تلقائياً كل ٥ دقائق • عند إدخاله ستظهر شاشة قبول</p>
                <button onClick={handleCopyCode} disabled={!inviteCode || isRegeneratingCode} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary transition-colors active:bg-primary/10 disabled:opacity-40" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                  {codeCopied ? "تم النسخ" : "نسخ الكود"}
                </button>
              </div>

              {/* Invite Link */}
              <div className="rounded-2xl p-4 bg-card" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
                <div className="flex items-center gap-2 mb-3 justify-end">
                  <span className="text-sm font-semibold text-foreground">رابط الدعوة</span>
                  <Link2 size={18} className="text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mb-3 text-right">أرسل رابط يُستخدم مرة واحدة للانضمام</p>
                <div className="flex gap-2">
                  <button onClick={handleShareLink} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-colors active:opacity-90 bg-primary">
                    <Share2 size={16} />
                    مشاركة الرابط
                  </button>
                  <button onClick={handleCopyLink} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-primary transition-colors active:bg-primary/10" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                    {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Drawer */}
      <Drawer open={showSetupDialog} onOpenChange={() => {}}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">إعداد الأسرة</DrawerTitle>
          </DrawerHeader>
          <p className="text-sm text-muted-foreground text-center">اختر دورك في الأسرة لإنشاء مجموعتك العائلية</p>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">دورك في الأسرة</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSetupRole("father")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    setupRole === "father" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                    <User size={22} className="text-primary" />
                  </div>
                  <span className="text-sm font-bold text-foreground">أب</span>
                </button>
                <button
                  onClick={() => setSetupRole("mother")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    setupRole === "mother" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                    <Heart size={22} className="text-primary" />
                  </div>
                  <span className="text-sm font-bold text-foreground">أم</span>
                </button>
                <button
                  onClick={() => setSetupRole("son")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    setupRole === "son" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(200, 60%, 92%)" }}>
                    <Baby size={22} className="text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-foreground">ابن</span>
                </button>
                <button
                  onClick={() => setSetupRole("daughter")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    setupRole === "daughter" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(340, 60%, 92%)" }}>
                    <Baby size={22} className="text-pink-500" />
                  </div>
                  <span className="text-sm font-bold text-foreground">ابنة</span>
                </button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                {(setupRole === "father" || setupRole === "mother") ? (
                  <>
                    <Crown size={12} className="inline ml-1 text-primary" />
                    ستكون المشرف الرئيسي على الأسرة. يمكنك لاحقاً إضافة {setupRole === "father" ? "زوجتك" : "زوجك"} كمشرف إضافي.
                  </>
                ) : (setupRole === "son" || setupRole === "daughter") ? (
                  <>
                    <ShieldCheck size={12} className="inline ml-1 text-primary" />
                    الأب والأم يحصلان على صلاحيات الإشراف بشكل افتراضي ولا يمكن إلغاء إشرافهم.
                  </>
                ) : (
                  <>
                    <Crown size={12} className="inline ml-1 text-primary" />
                    اختر دورك لمعرفة صلاحياتك في الأسرة.
                  </>
                )}
              </p>
            </div>

            <button
              onClick={handleSetupComplete}
              disabled={!setupRole}
              className="w-full py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary transition-colors disabled:opacity-40"
            >
              إنشاء الأسرة
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Member Drawer */}
      <Drawer open={showAddDialog} onOpenChange={(open) => !open && resetDialog()}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {addStep === "choose-type" && "إضافة فرد جديد"}
              {addStep === "enter-name" && `إضافة ${ROLE_LABELS[selectedType || "son"]}`}
              {addStep === "invite-method" && "تم الإضافة ✓"}
            </DrawerTitle>
          </DrawerHeader>

          {addStep === "choose-type" && (
            <div className="space-y-3 mt-2">
              {spouseRole && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground px-1">شريك/ة الحياة</p>
                  <button
                    onClick={() => { setSelectedType(spouseRole); setAddStep("enter-name"); }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl transition-colors active:bg-primary/10"
                    style={{ background: "hsl(var(--primary) / 0.06)", border: "2px solid hsl(var(--primary) / 0.2)" }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                      <RoleIcon role={spouseRole} size={22} className="text-primary" />
                    </div>
                    <div className="text-right flex-1">
                      <span className="text-sm font-bold text-foreground block">{ROLE_LABELS[spouseRole]}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Crown size={10} className="text-primary" />
                        سيكون مشرف على الأسرة
                      </span>
                    </div>
                  </button>
                </>
              )}

              <p className="text-xs font-semibold text-muted-foreground px-1">الأبناء</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedType("son"); setAddStep("enter-name"); }}
                  className="flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl transition-colors active:bg-primary/10"
                  style={{ background: "hsl(var(--primary) / 0.06)", border: "2px solid hsl(var(--primary) / 0.15)" }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(200, 60%, 92%)" }}>
                    <Baby size={24} className="text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-foreground">ابن</span>
                </button>
                <button
                  onClick={() => { setSelectedType("daughter"); setAddStep("enter-name"); }}
                  className="flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl transition-colors active:bg-primary/10"
                  style={{ background: "hsl(var(--primary) / 0.06)", border: "2px solid hsl(var(--primary) / 0.15)" }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(340, 60%, 92%)" }}>
                    <Baby size={24} className="text-pink-500" />
                  </div>
                  <span className="text-sm font-bold text-foreground">ابنة</span>
                </button>
              </div>

              {/* Staff roles */}
              <p className="text-xs font-semibold text-muted-foreground px-1 mt-3">طاقم المنزل</p>
              <div className="flex gap-2">
                {(["worker", "maid", "driver"] as FamilyRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setSelectedType(r); setAddStep("enter-name"); }}
                    className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors active:bg-primary/10"
                    style={{ background: "hsl(30, 50%, 95%)", border: "2px solid hsl(30, 40%, 85%)" }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "hsl(30, 50%, 90%)" }}>
                      <RoleIcon role={r} size={20} className="text-amber-700" />
                    </div>
                    <span className="text-xs font-bold text-foreground">{ROLE_LABELS[r]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {addStep === "enter-name" && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">الاسم</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`اسم ${ROLE_LABELS[selectedType || "son"]}`}
                  className="w-full px-4 py-3 rounded-xl text-right text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              {selectedType && isParentRole(selectedType) && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Crown size={10} className="text-primary" />
                    سيحصل على صلاحيات المشرف
                  </p>
                </div>
              )}
              {selectedType && !isParentRole(selectedType) && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <ShieldCheck size={10} className="text-primary" />
                    الأب والأم مشرفون بشكل افتراضي ولا يمكن إلغاء إشرافهم
                  </p>
                </div>
              )}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                  <Clock size={10} />
                  سيظهر العضو بحالة "بانتظار القبول" حتى يقبل الدعوة
                </p>
              </div>
              <button
                onClick={handleAddMember}
                disabled={!newName.trim()}
                className="w-full py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary transition-colors disabled:opacity-40"
              >
                <UserPlus size={16} className="inline ml-2" />
                إضافة
              </button>
            </div>
          )}

          {addStep === "invite-method" && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground text-center">تم إضافة {newName}. يمكنك الآن إرسال دعوة للانضمام:</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                  <Clock size={10} />
                  العضو بانتظار قبول الدعوة
                </p>
              </div>
              <button onClick={handleShareLink} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary">
                <Share2 size={16} />
                مشاركة رابط الدعوة
              </button>
              <button onClick={handleCopyCode} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                <Copy size={16} />
                نسخ كود الانضمام: {inviteCode}
              </button>
              <button onClick={resetDialog} className="w-full py-2.5 text-sm text-muted-foreground">
                تم
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Approval Drawer - When someone scans QR or enters code */}
      <Drawer open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">طلب انضمام جديد</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 mt-2">
            {/* Notification */}
            <div className="bg-primary/5 rounded-2xl p-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                <UserPlus size={28} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">شخص يريد الانضمام لأسرتك</p>
              <p className="text-xs text-muted-foreground">يجب أن يكون الجهازان بجانب بعضهما البعض</p>
            </div>

            {/* Choose role for new member */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">اختر دور العضو الجديد</label>

              {!hasSpouse && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 px-1">شريك/ة الحياة</p>
                  <div className="flex gap-2 mb-3">
                    {(creatorRole === "father" ? ["wife"] : creatorRole === "mother" ? ["husband"] : ["husband", "wife"]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setApprovalRole(r as FamilyRole)}
                        className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          approvalRole === r ? "border-primary bg-primary/10" : "border-border bg-card"
                        }`}
                      >
                        <RoleIcon role={r} size={18} className={approvalRole === r ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-xs font-bold text-foreground">{ROLE_LABELS[r]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 px-1">الأبناء</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setApprovalRole("son")}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    approvalRole === "son" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Baby size={18} className={approvalRole === "son" ? "text-blue-500" : "text-muted-foreground"} />
                  <span className="text-xs font-bold text-foreground">ابن</span>
                </button>
                <button
                  onClick={() => setApprovalRole("daughter")}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    approvalRole === "daughter" ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Baby size={18} className={approvalRole === "daughter" ? "text-pink-500" : "text-muted-foreground"} />
                  <span className="text-xs font-bold text-foreground">ابنة</span>
                </button>
              </div>

              {/* Staff roles in approval */}
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 px-1 mt-2">طاقم المنزل</p>
              <div className="flex gap-2">
                {(["worker", "maid", "driver"] as FamilyRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setApprovalRole(r)}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      approvalRole === r ? "border-amber-500 bg-amber-50" : "border-border bg-card"
                    }`}
                  >
                    <RoleIcon role={r} size={16} className={approvalRole === r ? "text-amber-700" : "text-muted-foreground"} />
                    <span className="text-xs font-bold text-foreground">{ROLE_LABELS[r]}</span>
                  </button>
                ))}
              </div>
            </div>

            {approvalRole && isParentRole(approvalRole) && (
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Crown size={10} className="text-primary" />
                  سيحصل على صلاحيات الإشراف تلقائياً
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleApproveJoin}
                disabled={!approvalRole}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary transition-colors disabled:opacity-40"
              >
                <Check size={16} className="inline ml-1" />
                قبول
              </button>
              <button
                onClick={() => { setShowApprovalDialog(false); setApprovalRole(null); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-foreground bg-muted transition-colors"
              >
                رفض
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* QR Scanner Drawer */}
      <Drawer open={showScanner} onOpenChange={(open) => { if (!open) { setShowScanner(false); setJoinCode(""); } }}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">مسح رمز QR للانضمام</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 mt-2">
            {/* Camera view */}
            <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-primary rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-2 h-0.5 bg-primary/80 animate-bounce" style={{ top: "50%" }} />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">وجّه الكاميرا نحو رمز QR الخاص بالعائلة</p>

            {/* Manual code entry */}
            <div className="bg-muted/50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 text-center">أو أدخل كود الانضمام يدوياً</p>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="أدخل الكود"
                  className="flex-1 px-4 py-3 rounded-xl text-center text-sm font-bold tracking-widest border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ direction: "ltr" }}
                  maxLength={6}
                />
                <button
                  onClick={handleManualJoin}
                  disabled={joinCode.length < 6}
                  className="px-5 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary disabled:opacity-40"
                >
                  انضمام
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default FamilyManagement;
