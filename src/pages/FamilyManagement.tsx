import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, QrCode, Copy, Link2, Check, UserPlus, Trash2, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface FamilyMember {
  id: string;
  name: string;
  role: "father" | "mother" | "son" | "daughter";
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
};

const FamilyManagement = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([
    { id: "1", name: "أحمد", role: "father" },
    { id: "2", name: "فاطمة", role: "mother" },
    { id: "3", name: "محمد", role: "son" },
    { id: "4", name: "سارة", role: "daughter" },
  ]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addStep, setAddStep] = useState<"choose-type" | "enter-name" | "invite-method">("choose-type");
  const [selectedType, setSelectedType] = useState<"son" | "daughter" | null>(null);
  const [newName, setNewName] = useState("");
  const [inviteCode, setInviteCode] = useState(generateInviteCode);
  const [codeTimer, setCodeTimer] = useState(300);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});

  // Code timer countdown
  useEffect(() => {
    if (!showAddDialog || addStep !== "invite-method") return;
    const interval = setInterval(() => {
      setCodeTimer((t) => {
        if (t <= 1) {
          setInviteCode(generateInviteCode());
          return 300;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showAddDialog, addStep]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleAddMember = () => {
    if (!selectedType || !newName.trim()) return;
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name: newName.trim(),
      role: selectedType,
    };
    setMembers((prev) => [...prev, newMember]);
    setAddStep("invite-method");
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setSwipedId(null);
    setSwipeOffset({});
    toast({ title: "تم حذف الفرد من الأسرة" });
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

  const resetDialog = () => {
    setShowAddDialog(false);
    setAddStep("choose-type");
    setSelectedType(null);
    setNewName("");
    setCodeTimer(300);
    setInviteCode(generateInviteCode());
  };

  // Swipe handlers - using refs to avoid stale closures
  const touchStartXRef = React.useRef(0);
  const swipeOffsetRef = React.useRef<Record<string, number>>({});

  const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
    touchStartXRef.current = e.touches[0].clientX;
    // Reset any other open swipes
    setSwipeOffset((prev) => {
      const reset: Record<string, number> = {};
      Object.keys(prev).forEach((k) => { reset[k] = k === id ? prev[k] : 0; });
      return reset;
    });
    setSwipedId(id);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, id: string) => {
    const diff = touchStartXRef.current - e.touches[0].clientX;
    // RTL layout: swipe left (negative clientX movement) reveals delete on left side
    if (diff > 0) {
      const offset = Math.min(diff, 80);
      swipeOffsetRef.current = { ...swipeOffsetRef.current, [id]: offset };
      setSwipeOffset((prev) => ({ ...prev, [id]: offset }));
    } else {
      swipeOffsetRef.current = { ...swipeOffsetRef.current, [id]: 0 };
      setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    }
  }, []);

  const handleTouchEnd = useCallback((id: string) => {
    const offset = swipeOffsetRef.current[id] || 0;
    if (offset > 40) {
      setSwipeOffset((prev) => ({ ...prev, [id]: 80 }));
      swipeOffsetRef.current = { ...swipeOffsetRef.current, [id]: 80 };
    } else {
      setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
      swipeOffsetRef.current = { ...swipeOffsetRef.current, [id]: 0 };
      setSwipedId(null);
    }
  }, []);

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col" style={{
      background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 95%) 100%)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div />
        <h1 className="text-lg font-bold text-foreground">إدارة أفراد الأسرة</h1>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground" style={{ background: "hsla(0,0%,0%,0.05)" }}>
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Members List */}
      <div className="flex-1 px-4 pb-8">
        <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">أفراد الأسرة ({members.length})</h2>
        <div className="space-y-2">
          {members.map((member) => {
            const offset = swipeOffset[member.id] || 0;
            const isParent = member.role === "father" || member.role === "mother";
            return (
              <div key={member.id} className="relative overflow-hidden rounded-2xl">
                {/* Delete button behind - positioned on the left for RTL swipe */}
                {!isParent && (
                  <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center rounded-2xl" style={{ background: "hsl(var(--destructive))" }}>
                    <button onClick={() => handleRemoveMember(member.id)} className="flex flex-col items-center gap-1 text-white">
                      <Trash2 size={18} />
                      <span className="text-[10px]">حذف</span>
                    </button>
                  </div>
                )}

                {/* Card */}
                <div
                  className="relative flex items-center gap-3 px-4 py-3.5 transition-transform"
                  style={{
                    background: "hsla(0,0%,100%,0.9)",
                    boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
                    transform: `translateX(${offset}px)`,
                  }}
                  onTouchStart={(e) => !isParent && handleTouchStart(e, member.id)}
                  onTouchMove={(e) => !isParent && handleTouchMove(e, member.id)}
                  onTouchEnd={() => !isParent && handleTouchEnd(member.id)}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{
                    background: isParent ? "hsl(var(--primary) / 0.15)" : "hsl(var(--accent) / 0.15)",
                  }}>
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-sm font-bold" style={{ color: isParent ? "hsl(var(--primary))" : "hsl(var(--accent))" }}>
                        {member.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-semibold text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</p>
                  </div>
                  {isParent && (
                    <span className="text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
                      مشرف
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add button */}
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

        {/* Invite section */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1">طرق الانضمام</h2>
          <div className="space-y-3">
            {/* QR Code */}
            <div className="rounded-2xl p-4 text-center" style={{
              background: "hsla(0,0%,100%,0.9)",
              boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
            }}>
              <div className="flex items-center justify-center gap-2 mb-3">
                <QrCode size={18} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">رمز QR</span>
              </div>
              <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{
                background: "hsl(var(--muted))",
                border: "2px solid hsl(var(--border))",
              }}>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded-sm" style={{
                      background: Math.random() > 0.4 ? "hsl(var(--foreground))" : "transparent",
                    }} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">امسح الرمز للانضمام للأسرة</p>
            </div>

            {/* Invite Code */}
            <div className="rounded-2xl p-4" style={{
              background: "hsla(0,0%,100%,0.9)",
              boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
            }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">ينتهي خلال {formatTime(codeTimer)}</span>
                <span className="text-sm font-semibold text-foreground">كود الانضمام</span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="flex gap-1.5 direction-ltr" style={{ direction: "ltr" }}>
                  {inviteCode.split("").map((char, i) => (
                    <div key={i} className="w-10 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-foreground" style={{
                      background: "hsl(var(--muted))",
                      border: "1px solid hsl(var(--border))",
                    }}>
                      {char}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleCopyCode} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary transition-colors active:bg-primary/10" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                {codeCopied ? "تم النسخ" : "نسخ الكود"}
              </button>
            </div>

            {/* Invite Link */}
            <div className="rounded-2xl p-4" style={{
              background: "hsla(0,0%,100%,0.9)",
              boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
            }}>
              <div className="flex items-center gap-2 mb-3 justify-end">
                <span className="text-sm font-semibold text-foreground">رابط الدعوة</span>
                <Link2 size={18} className="text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mb-3 text-right">أرسل رابط يُستخدم مرة واحدة للانضمام</p>
              <div className="flex gap-2">
                <button onClick={handleShareLink} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors active:opacity-90" style={{ background: "hsl(var(--primary))" }}>
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
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-sm rounded-3xl" style={{ direction: "rtl" }}>
          <DialogHeader>
            <DialogTitle className="text-center">
              {addStep === "choose-type" && "إضافة فرد جديد"}
              {addStep === "enter-name" && `إضافة ${selectedType === "son" ? "ابن" : "ابنة"}`}
              {addStep === "invite-method" && "تم الإضافة ✓"}
            </DialogTitle>
          </DialogHeader>

          {addStep === "choose-type" && (
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setSelectedType("son"); setAddStep("enter-name"); }}
                className="flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl transition-colors active:bg-primary/10"
                style={{ background: "hsl(var(--primary) / 0.06)", border: "2px solid hsl(var(--primary) / 0.15)" }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: "hsl(200, 60%, 92%)" }}>👦</div>
                <span className="text-sm font-bold text-foreground">ابن</span>
              </button>
              <button
                onClick={() => { setSelectedType("daughter"); setAddStep("enter-name"); }}
                className="flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl transition-colors active:bg-primary/10"
                style={{ background: "hsl(var(--primary) / 0.06)", border: "2px solid hsl(var(--primary) / 0.15)" }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: "hsl(340, 60%, 92%)" }}>👧</div>
                <span className="text-sm font-bold text-foreground">ابنة</span>
              </button>
            </div>
          )}

          {addStep === "enter-name" && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-2">الاسم</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={selectedType === "son" ? "اسم الابن" : "اسم الابنة"}
                  className="w-full px-4 py-3 rounded-xl text-right text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <button
                onClick={handleAddMember}
                disabled={!newName.trim()}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                style={{ background: "hsl(var(--primary))" }}
              >
                <UserPlus size={16} className="inline ml-2" />
                إضافة
              </button>
            </div>
          )}

          {addStep === "invite-method" && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground text-center">تم إضافة {newName}. يمكنك الآن إرسال دعوة للانضمام:</p>
              <button onClick={handleShareLink} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "hsl(var(--primary))" }}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FamilyManagement;
