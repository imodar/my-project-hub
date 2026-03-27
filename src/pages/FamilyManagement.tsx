import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, QrCode, Copy, Check, UserPlus, Trash2, Share2, Crown, User, Baby, ShieldCheck, Heart, Clock, Shield, Briefcase, Car, ScanLine, X, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import SwipeableCard from "@/components/SwipeableCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { ROLE_LABELS, isParentRole, isStaffRole } from "@/contexts/UserRoleContext";

type FamilyRole = "father" | "mother" | "son" | "daughter" | "husband" | "wife" | "worker" | "maid" | "driver";
type JoinRole = "father" | "mother" | "son" | "daughter";
type InviteStatus = "active" | "pending";

interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
  isCreator?: boolean;
  isAdmin?: boolean;
  status: InviteStatus;
  avatar?: string;
  roleConfirmed?: boolean;
}

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

// Swipe constants removed — using shared SwipeableCard


// Real QR Code — encodes full URL with invite code
const QrPattern = React.memo(({ code }: { code: string }) => {
  const qrUrl = useMemo(() => {
    const fullUrl = `https://ailti.lovable.app/join-or-create?code=${encodeURIComponent(code)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(fullUrl)}&margin=4`;
  }, [code]);

  return (
    <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center mb-3 bg-white border-2 border-border overflow-hidden">
      <img
        src={qrUrl}
        alt="رمز QR للانضمام للعائلة"
        width={140}
        height={140}
        className="rounded"
        loading="eager"
      />
    </div>
  );
});

const FamilyManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const queryClient = useQueryClient();
  const { members: dbMembers, isLoading: membersLoading, refetch: refetchMembers } = useFamilyMembers({ excludeSelf: false });

  // Map DB members to local FamilyMember interface
  const members: FamilyMember[] = useMemo(() =>
    dbMembers.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role as FamilyRole,
      isCreator: m.isCreator,
      isAdmin: m.isAdmin,
      status: "active" as InviteStatus,
      roleConfirmed: m.roleConfirmed,
    })),
  [dbMembers]);

  // Current user's role from DB
  const myMember = useMemo(() => dbMembers.find((m) => m.id === user?.id), [dbMembers, user]);
  const creatorRole = (myMember?.role as FamilyRole) || null;
  const isMyAdmin = myMember?.isAdmin || false;

  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupRole, setSetupRole] = useState<"father" | "mother" | "son" | "daughter" | null>(null);

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Join role selection state
  const [showJoinRoleGrid, setShowJoinRoleGrid] = useState(false);
  const [joinRole, setJoinRole] = useState<JoinRole | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState("");

  // No auto-open setup dialog — inline UI handles !familyId case

  const handleSetupComplete = async () => {
    if (!setupRole) return;
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "create", name: user?.user_metadata?.name || "عائلتي", role: setupRole },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل إنشاء الأسرة", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["family-id"] });
      queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
      setShowSetupDialog(false);
      toast({ title: "تم إنشاء الأسرة بنجاح!" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  // Add member dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addStep, setAddStep] = useState<"choose-type" | "enter-name" | "invite-method">("choose-type");
  const [selectedType, setSelectedType] = useState<FamilyRole | null>(null);
  const [newName, setNewName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeTimer, setCodeTimer] = useState(300);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  // Role confirmation drawer
  const [confirmMember, setConfirmMember] = useState<FamilyMember | null>(null);
  const [confirmRole, setConfirmRole] = useState<FamilyRole | null>(null);
  const [confirmingRole, setConfirmingRole] = useState(false);

  // Role warning banner
  const [roleWarningDismissed, setRoleWarningDismissed] = useState(() =>
    familyId ? !!localStorage.getItem(`role_warning_dismissed_${familyId}`) : true
  );

  useEffect(() => {
    if (familyId) {
      setRoleWarningDismissed(!!localStorage.getItem(`role_warning_dismissed_${familyId}`));
    }
  }, [familyId]);

  // Swipe state managed by SwipeableCard

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
    // Skip fake member creation — go straight to invite method
    setAddStep("invite-method");
  };

  const handleRemoveMember = async (id: string) => {
    if (!familyId) return;
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "remove-member", family_id: familyId, target_user_id: id },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل حذف العضو", variant: "destructive" });
        return;
      }
      refetchMembers();
      
      toast({ title: "تم حذف الفرد من الأسرة" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleToggleAdmin = async (id: string) => {
    if (!familyId) return;
    const member = members.find((m) => m.id === id);
    if (!member) return;
    if (isParentRole(member.role)) {
      toast({ title: "لا يمكن إلغاء إشراف الوالدين", variant: "destructive" });
      return;
    }
    const newAdmin = !member.isAdmin;
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "toggle-admin", family_id: familyId, target_user_id: id, is_admin: newAdmin },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل تعديل الصلاحية", variant: "destructive" });
        return;
      }
      refetchMembers();
      toast({ title: newAdmin ? `تم تعيين ${member.name} كمشرف` : `تم إلغاء إشراف ${member.name}` });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({ title: "تم نسخ الكود" });
  };

  const handleShareInvite = async () => {
    const text = `انضم لأسرتنا في عيلتي!\n\nكود الانضمام: ${inviteCode}\n\nافتح التطبيق وأدخل الكود من صفحة "انضم لعائلة"`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "دعوة انضمام للأسرة", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "تم نسخ رسالة الدعوة" });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "تم نسخ رسالة الدعوة" });
      } catch {}
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
                // Extract code from URL if needed, then initiate join with role selection
                const extracted = code.includes("code=")
                  ? new URL(code).searchParams.get("code") || code
                  : code;
                initiateJoin(extracted);
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

  const initiateJoin = (codeValue: string) => {
    if (!codeValue.trim()) return;
    setPendingJoinCode(codeValue.trim());
    setShowJoinRoleGrid(true);
  };

  const handleJoinByCode = async () => {
    if (!pendingJoinCode || !joinRole) return;
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "join", invite_code: pendingJoinCode, role: joinRole },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل الانضمام", variant: "destructive" });
      } else {
        toast({ title: "تم الانضمام بنجاح! 🎉" });
        queryClient.invalidateQueries({ queryKey: ["family-id"] });
        queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
        refetchMembers();
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setShowJoinRoleGrid(false);
      setJoinRole(null);
      setPendingJoinCode("");
    }
  };

  const handleManualJoin = () => {
    if (!joinCode.trim()) return;
    initiateJoin(joinCode);
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

  // Note: approval flow removed — joining is instant via edge function

  const handleConfirmRole = async () => {
    if (!confirmMember || !confirmRole || !familyId || confirmingRole) return;
    setConfirmingRole(true);
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "confirm-role", family_id: familyId, target_user_id: confirmMember.id, role: confirmRole },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل تأكيد الدور", variant: "destructive" });
      } else {
        refetchMembers();
        toast({ title: `تم تأكيد دور ${confirmMember.name}` });
        setConfirmMember(null);
        setConfirmRole(null);
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setConfirmingRole(false);
    }
  };

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leavingFamily, setLeavingFamily] = useState(false);

  const handleLeaveFamily = async () => {
    if (!familyId || !user) return;
    setLeavingFamily(true);
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "leave", family_id: familyId },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "فشل مغادرة العائلة", variant: "destructive" });
        return;
      }
      localStorage.removeItem("cached_family_id");
      queryClient.invalidateQueries({ queryKey: ["family-id"] });
      queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
      toast({ title: "تم مغادرة العائلة بنجاح" });
      setShowLeaveConfirm(false);
      navigate("/", { replace: true });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setLeavingFamily(false);
    }
  };

  const dismissRoleWarning = () => {
    if (familyId) {
      localStorage.setItem(`role_warning_dismissed_${familyId}`, "true");
    }
    setRoleWarningDismissed(true);
  };

  const spouseRole = getSpouseRole();

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div />
        <h1 className="text-lg font-bold text-foreground">إدارة أفراد الأسرة</h1>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground bg-muted/50">
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Members List or Inline Join/Create UI */}
      <div className="flex-1 px-4 pb-32">
        {membersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !familyId ? (
          /* Inline UI when user has no family */
          <div className="space-y-6 mt-4">
            {/* Join existing family */}
            <div className="rounded-2xl p-5 bg-card" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
              <h3 className="text-base font-bold text-foreground mb-1 text-center">انضم لعائلة موجودة</h3>
              <p className="text-xs text-muted-foreground text-center mb-4">أدخل كود الدعوة أو امسح رمز QR</p>
              <div className="flex gap-2 mb-3" dir="ltr">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="أدخل الكود"
                  className="flex-1 px-4 py-3 rounded-xl text-center text-sm font-bold tracking-widest border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={8}
                />
                <button
                  onClick={handleManualJoin}
                  disabled={joinCode.length < 8}
                  className="px-5 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary disabled:opacity-40"
                >
                  انضمام
                </button>
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary border-2 border-primary/20 transition-colors active:bg-primary/5"
              >
                <ScanLine size={16} />
                مسح رمز QR
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">أو</span>
              </div>
            </div>

            {/* Create new family */}
            <button
              onClick={() => setShowSetupDialog(true)}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-primary-foreground bg-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              إنشاء عائلة جديدة
            </button>
          </div>
        ) : (
        <>
        {/* Role warning banner — admins only, dismissible */}
        {isMyAdmin && members.length > 1 && !roleWarningDismissed && (
          <div className="flex items-start gap-2 p-3 rounded-xl mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 flex-1 leading-relaxed">
              في حال اختيار دور خاطئ لأي عضو، يجب إزالته وإعادة دعوته لتصحيح الدور.
            </p>
            <button onClick={dismissRoleWarning} className="shrink-0 p-0.5 rounded-full text-amber-500 active:bg-amber-200/50">
              <X size={14} />
            </button>
          </div>
        )}

        <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">أفراد الأسرة ({members.length})</h2>
        <div className="space-y-2">
          {members.map((member) => {
            const memberIsAdmin = member.isAdmin || isParentRole(member.role);
            const canSwipe = !member.isCreator;
            const isPending = member.status === "pending";
            return (
              <SwipeableCard
                key={member.id}
                actions={canSwipe ? [
                  { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => handleRemoveMember(member.id) },
                  { icon: <Shield size={16} />, label: memberIsAdmin ? "إلغاء" : "مشرف", color: memberIsAdmin ? "bg-muted-foreground" : "bg-primary", onClick: () => handleToggleAdmin(member.id) },
                ] : []}
              >
                <div
                  className="relative flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl"
                  style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}
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
                    {!member.roleConfirmed && isMyAdmin && !member.isCreator && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmMember(member); setConfirmRole(member.role); }}
                        className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mt-0.5 active:bg-amber-200"
                      >
                        <ShieldCheck size={8} />
                        تأكيد الدور
                      </button>
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
              </SwipeableCard>
            );
          })}
        </div>

        {/* Add button — only for admins */}
        {isMyAdmin && (
          <button
            onClick={() => { setShowAddDialog(true); setAddStep("invite-method"); }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-semibold text-primary transition-colors active:bg-primary/10"
            style={{
              background: "hsl(var(--primary) / 0.08)",
              border: "2px dashed hsl(var(--primary) / 0.3)",
            }}
          >
            <Plus size={18} />
            دعوة فرد جديد
          </button>
        )}


        {/* Join another family section */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">الانضمام لعائلة أخرى</h2>
          <div className="rounded-2xl p-4 bg-card" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <UserPlus size={18} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">انضم لعائلة بالكود</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 text-right">أدخل كود الدعوة للانضمام لعائلة جديدة (سيتم مغادرة العائلة الحالية)</p>
            <div className="flex gap-2 mb-2 flex-row-reverse">
              <button
                onClick={handleManualJoin}
                disabled={joinCode.length < 8}
                className="shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary disabled:opacity-40"
              >
                انضمام
              </button>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="أدخل الكود"
                dir="ltr"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl text-center text-sm font-bold tracking-widest border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={8}
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary border-2 border-primary/20 transition-colors active:bg-primary/5"
            >
              <ScanLine size={16} />
              مسح رمز QR
            </button>
          </div>
        </div>

        {/* Leave family section — only when user has a family and is not the only member */}
        {familyId && members.length > 1 && (
        <div className="mt-8 mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">مغادرة العائلة</h2>
          <div className="rounded-2xl p-4 bg-card border border-destructive/20" style={{ boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)" }}>
            <p className="text-xs text-muted-foreground mb-3 text-right">سيتم إزالتك من العائلة الحالية ولن تتمكن من الوصول لبياناتها</p>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-destructive transition-colors active:bg-destructive/10 border-2 border-destructive/20"
            >
              <Trash2 size={16} />
              مغادرة العائلة
            </button>
          </div>
        </div>
        )}
        </>
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
              {addStep === "invite-method" && "دعوة فرد جديد"}
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
            <div className="space-y-4 mt-2">
              {/* QR Code */}
              <QrPattern code={inviteCode} />

              {/* Progress bar */}
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(codeTimer / 300) * 100}%`,
                    background: codeTimer < 60 ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                  }}
                />
              </div>

              {/* Code digits */}
              <div className="flex items-center justify-center gap-1.5" style={{ direction: "ltr" }}>
                {(inviteCode || "--------").split("").map((char, i) => (
                  <div key={i} className="w-9 h-11 rounded-xl flex items-center justify-center text-base font-bold text-foreground bg-muted border border-border">
                    {isRegeneratingCode ? "·" : char}
                  </div>
                ))}
              </div>

              {/* Timer + refresh */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={regenerateCode}
                  disabled={isRegeneratingCode}
                  className="p-1 rounded-full transition-colors active:bg-muted"
                >
                  <RefreshCw size={13} className={`text-muted-foreground ${isRegeneratingCode ? "animate-spin" : ""}`} />
                </button>
                <span className="text-[11px] text-muted-foreground">يتجدد خلال {formatTime(codeTimer)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  disabled={!inviteCode || isRegeneratingCode}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary transition-colors active:bg-primary/10 disabled:opacity-40"
                  style={{ background: "hsl(var(--primary) / 0.08)" }}
                >
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                  {codeCopied ? "تم النسخ" : "نسخ الكود"}
                </button>
                <button
                  onClick={handleShareInvite}
                  disabled={!inviteCode || isRegeneratingCode}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground bg-primary transition-colors disabled:opacity-40"
                >
                  <Share2 size={16} />
                  مشاركة
                </button>
              </div>

              <button onClick={resetDialog} className="w-full py-2.5 text-sm text-muted-foreground">
                تم
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

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
                  maxLength={8}
                />
                <button
                  onClick={handleManualJoin}
                  disabled={joinCode.length < 8}
                  className="px-5 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary disabled:opacity-40"
                >
                  انضمام
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Role Confirmation Drawer */}
      <Drawer open={!!confirmMember} onOpenChange={(open) => { if (!open) { setConfirmMember(null); setConfirmRole(null); } }}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">{confirmMember?.name} — تأكيد الدور</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground text-center">حدد دور {confirmMember?.name} في العائلة:</p>
            <div className="grid grid-cols-3 gap-2">
              {(["father", "mother", "husband", "wife", "son", "daughter", "worker", "maid", "driver"] as FamilyRole[]).map((r) => {
                const selected = confirmRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setConfirmRole(r)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      selected ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <RoleIcon role={r} size={18} className={selected ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-xs font-bold text-foreground">{ROLE_LABELS[r]}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleConfirmRole}
              disabled={!confirmRole || confirmingRole}
              className="w-full py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {confirmingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الدور"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Leave Family Confirmation Drawer */}
      <Drawer open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DrawerContent className="px-4 pb-6" style={{ direction: "rtl" }}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg">مغادرة العائلة</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              هل أنت متأكد من مغادرة العائلة؟ لن تتمكن من الوصول لبياناتها بعد ذلك.
            </p>
            <button
              onClick={handleLeaveFamily}
              disabled={leavingFamily}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-destructive-foreground bg-destructive transition-colors disabled:opacity-50"
            >
              {leavingFamily ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
              {leavingFamily ? "جاري المغادرة..." : "نعم، مغادرة العائلة"}
            </button>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-foreground bg-muted transition-colors"
            >
              إلغاء
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default FamilyManagement;
