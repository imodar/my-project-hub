import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  Lock, KeyRound, CheckCircle2, Circle,
  Shield, Eye, EyeOff, Trash2, RotateCcw, AlertTriangle,
  ChevronLeft, ShieldAlert,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { haptic } from "@/lib/haptics";
import { appToast } from "@/lib/toast";
import { useWill } from "@/hooks/useWill";
import { supabase } from "@/integrations/supabase/client";

// ── SHA-256 helper (legacy) ──
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── PBKDF2 helpers ──
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function bufToBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}
function base64ToBuf(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));
}

async function hashPasswordPBKDF2(password: string, salt?: Uint8Array): Promise<{ hash: string; salt: string }> {
  const s = salt || new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new Uint8Array(s).buffer, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  return { hash: bufToHex(bits), salt: bufToBase64(s) };
}

async function verifyPasswordPBKDF2(password: string, storedHash: string, saltB64: string): Promise<boolean> {
  const salt = base64ToBuf(saltB64);
  const { hash } = await hashPasswordPBKDF2(password, salt);
  return hash === storedHash;
}

// ── Types ──
interface WillSection {
  id: string;
  icon: string;
  label: string;
  completed: boolean;
  content: string;
}

const DEFAULT_SECTIONS: WillSection[] = [
  { id: "property", icon: "🏠", label: "توزيع الممتلكات", completed: false, content: "" },
  { id: "messages", icon: "💌", label: "رسائل لأفراد العائلة", completed: false, content: "" },
  { id: "guardian", icon: "👨‍👧‍👦", label: "الوصي على الأطفال", completed: false, content: "" },
  { id: "charity", icon: "🕌", label: "الوصايا الخيرية", completed: false, content: "" },
  { id: "funeral", icon: "🌿", label: "تعليمات الجنازة", completed: false, content: "" },
];

const Will = () => {
  const { will, isLoading, upsertWill, deleteWill } = useWill();
  const { user } = useAuth();
  const [sections, setSections] = useState<WillSection[]>(DEFAULT_SECTIONS);

  // ── Core states ──
  const [isUnlocked, setIsUnlocked] = useState(false);

  // ── Create password (first time) ──
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // ── Enter password (returning user) ──
  const [enterPassword, setEnterPassword] = useState("");
  const [showEnterPassword, setShowEnterPassword] = useState(false);
  const [enterError, setEnterError] = useState("");

  // ── Section editing ──
  const [editingSection, setEditingSection] = useState<WillSection | null>(null);
  const [sectionContent, setSectionContent] = useState("");

  // ── Delete will ──
  const [deleteDrawer, setDeleteDrawer] = useState(false);

  // ── Reset password flow ──
  const [resetStep, setResetStep] = useState<"confirm" | "otp" | null>(null);
  const [resetOtp, setResetOtp] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [expectedOtp, setExpectedOtp] = useState("");

  // Sync DB will data into local sections state
  useEffect(() => {
    if (will?.sections && Array.isArray(will.sections)) {
      setSections(will.sections as unknown as WillSection[]);
    }
  }, [will]);

  const willQueryClient = useQueryClient();
  const handleRefresh = async () => {
    await willQueryClient.invalidateQueries({ queryKey: ["will"] });
  };

  // Determine state
  const isFirstTime = !will || !will.password_hash;
  const hasPassword = !!will?.password_hash;

  // ── Create password handler ──
  const handleCreatePassword = async () => {
    if (!createPassword.trim() || createPassword !== createPasswordConfirm) return;
    if (createPassword.length < 4) {
      appToast.error("كلمة المرور قصيرة جداً", "يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    const { hash, salt } = await hashPasswordPBKDF2(createPassword);
    upsertWill.mutate(
      { sections: DEFAULT_SECTIONS, password_hash: hash, password_salt: salt },
      {
        onSuccess: () => {
          setIsUnlocked(true);
          setCreatePassword("");
          setCreatePasswordConfirm("");
          haptic.medium();
          appToast.success("تم إنشاء الوصية", "وصيتك الآن محمية بكلمة مرور");
        },
        onError: () => {
          appToast.error("حدث خطأ");
        },
      }
    );
  };

  // ── Enter password handler ──
  const handleEnterPassword = async () => {
    if (!enterPassword.trim()) return;
    setEnterError("");
    let valid = false;
    if (!will?.password_salt) {
      // Legacy SHA-256 (no salt)
      const hash = await sha256(enterPassword);
      valid = hash === will?.password_hash;
    } else {
      // PBKDF2 with salt
      valid = await verifyPasswordPBKDF2(enterPassword, will.password_hash, will.password_salt);
    }
    if (valid) {
      haptic.medium();
      setIsUnlocked(true);
      setEnterPassword("");
      appToast.success("تم فتح الوصية", "يمكنك الآن تعديل وصيتك");
    } else {
      setEnterError("كلمة المرور غير صحيحة");
      haptic.heavy();
    }
  };

  // ── Reset password: request OTP ──
  const handleRequestReset = async () => {
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: { action: "request-reset-otp" },
      });
      if (error || data?.error) {
        appToast.error("فشل إرسال الرمز", data?.error || error?.message);
        return;
      }
      // In production, SMS is sent. For now, code is returned for testing
      if (data?.code) {
        setExpectedOtp(data.code);
        appToast.success(`رمز التحقق: ${data.code}`, "تم إرسال الرمز لرقم جوالك");
      } else {
        appToast.success("تم إرسال رمز التحقق", "تحقق من رسائل جوالك");
      }
      setResetStep("otp");
    } catch {
      appToast.error("حدث خطأ");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Reset password: verify OTP and delete will ──
  const handleVerifyResetOtp = async () => {
    if (resetOtp.length !== 6) return;
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("will-api", {
        body: { action: "verify-reset-otp", code: resetOtp },
      });
      if (error || data?.error) {
        appToast.error("الرمز غير صحيح", data?.error || error?.message);
        setResetLoading(false);
        return;
      }
      // OTP verified — delete will
      deleteWill.mutate(undefined, {
        onSuccess: () => {
          setSections(DEFAULT_SECTIONS);
          setIsUnlocked(false);
          setResetStep(null);
          setResetOtp("");
          setEnterPassword("");
          haptic.heavy();
          appToast.success("تم حذف الوصية", "تم مسح الوصية وكلمة المرور بالكامل. يمكنك إنشاء وصية جديدة.");
        },
        onError: () => {
          appToast.error("فشل حذف الوصية");
        },
      });
    } catch {
      appToast.error("حدث خطأ");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Section handlers ──
  const handleOpenSection = (section: WillSection) => {
    haptic.light();
    setEditingSection(section);
    setSectionContent(section.content);
  };

  const handleSaveSection = () => {
    if (!editingSection) return;
    haptic.medium();
    const updated = sections.map(s =>
      s.id === editingSection.id
        ? { ...s, content: sectionContent, completed: sectionContent.trim().length > 0 }
        : s
    );
    setSections(updated);
    upsertWill.mutate({ sections: updated });
    setEditingSection(null);
    appToast.success("تم الحفظ", `تم حفظ "${editingSection.label}" بنجاح`);
  };

  const handleDeleteWill = () => {
    haptic.heavy();
    deleteWill.mutate(undefined, {
      onSuccess: () => {
        setSections(DEFAULT_SECTIONS.map(s => ({ ...s, completed: false, content: "" })));
        setDeleteDrawer(false);
        setIsUnlocked(false);
        appToast.success("تم حذف الوصية", "تم مسح جميع محتويات الوصية");
      },
    });
  };

  const completedCount = sections.filter((s) => s.completed).length;

  return (
    <div className="min-h-screen bg-background relative pb-32">
      <PageHeader title="الوصية" subtitle="وصيتك الشرعية محفوظة وآمنة" />

      {isLoading ? (
        <div className="px-4 py-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <PullToRefresh onRefresh={handleRefresh}>
          {/* ── Hero Hadith ── */}
          <div
            className="mx-4 mt-5 rounded-2xl p-5 text-center"
            style={{
              background: "linear-gradient(135deg, hsl(145 60% 30%), hsl(155 50% 25%))",
            }}
          >
            <p
              className="text-white/90 text-sm leading-[2] font-medium"
              style={{ fontFamily: "'Amiri', serif" }}
            >
              «ما حقُّ امرئٍ مسلمٍ له شيءٌ يوصي فيه يبيتُ ليلتينِ إلا ووصيتُهُ مكتوبةٌ عندَه»
            </p>
            <p className="text-white/50 text-[10px] mt-2">متفق عليه</p>
          </div>

          {/* ════════════════════════════════════════ */}
          {/* ── STATE 1: First time — Create Password ── */}
          {/* ════════════════════════════════════════ */}
          {!isUnlocked && isFirstTime && (
            <div className="mx-4 mt-6 space-y-4">
              {/* Security info */}
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Shield className="text-emerald-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <h3 className="text-sm font-bold text-foreground">أنشئ كلمة مرور لوصيتك</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      وصيتك ستكون مشفّرة بالكامل ولن يتمكن أحد من قراءتها بدون كلمة المرور.
                    </p>
                  </div>
                </div>
              </div>

              {/* ⚠️ Critical warning */}
              <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-right">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-destructive font-bold">تحذير مهم جداً</p>
                    <p className="text-xs text-destructive/80 leading-relaxed mt-1">
                      في حال نسيان كلمة المرور، لن يتمكن أحد من فتح الوصية —
                      ولا حتى أنت شخصياً. الخيار الوحيد سيكون <strong>حذف الوصية بالكامل</strong> وإنشاء واحدة جديدة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password fields */}
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="h-12 rounded-xl pr-4 pl-12 text-right"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="تأكيد كلمة المرور"
                  value={createPasswordConfirm}
                  onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                  className="h-12 rounded-xl pr-4 text-right"
                  dir="rtl"
                />
                {createPassword && createPasswordConfirm && createPassword !== createPasswordConfirm && (
                  <p className="text-[11px] text-destructive text-right">كلمتا المرور غير متطابقتين</p>
                )}
                <Button
                  onClick={handleCreatePassword}
                  disabled={!createPassword.trim() || createPassword !== createPasswordConfirm || upsertWill.isPending}
                  className="w-full h-12 rounded-2xl text-sm font-bold gap-2"
                >
                  <KeyRound size={16} />
                  إنشاء الوصية وحمايتها
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* ── STATE 2: Has password — Enter Password ── */}
          {/* ════════════════════════════════════════ */}
          {!isUnlocked && hasPassword && (
            <div className="mx-4 mt-6 space-y-4">
              {/* Security card */}
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Lock className="text-emerald-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <h3 className="text-sm font-bold text-foreground">وصيتك محمية</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      أدخل كلمة المرور لفتح وتعديل وصيتك.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password input */}
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showEnterPassword ? "text" : "password"}
                    placeholder="كلمة المرور"
                    value={enterPassword}
                    onChange={(e) => { setEnterPassword(e.target.value); setEnterError(""); }}
                    className="h-12 rounded-xl pr-4 pl-12 text-right"
                    dir="rtl"
                    onKeyDown={(e) => e.key === "Enter" && handleEnterPassword()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEnterPassword(!showEnterPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showEnterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {enterError && (
                  <p className="text-[11px] text-destructive text-right">{enterError}</p>
                )}

                <Button
                  onClick={handleEnterPassword}
                  disabled={!enterPassword.trim()}
                  className="w-full h-12 rounded-2xl text-sm font-bold gap-2"
                >
                  <KeyRound size={16} />
                  فتح الوصية
                </Button>

                {/* Reset password button */}
                <button
                  onClick={() => { haptic.light(); setResetStep("confirm"); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <ShieldAlert size={13} />
                    نسيت كلمة المرور؟
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* ── STATE 3: Unlocked — Will Sections ── */}
          {/* ════════════════════════════════════════ */}
          {isUnlocked && (
            <>
              {/* Security status */}
              <div className="mx-4 mt-4 rounded-2xl bg-card border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Shield className="text-emerald-600" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Lock size={14} className="text-emerald-600" />
                      الوصية مفتوحة
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      يمكنك تعديل أقسام وصيتك الآن. التغييرات تُحفظ تلقائياً.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div className="mx-4 mt-5">
                <h2 className="text-sm font-bold text-foreground mb-3">أقسام الوصية</h2>
                <div className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => handleOpenSection(section)}
                      className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 active:scale-[0.98] transition-transform"
                    >
                      <span className="text-xl">{section.icon}</span>
                      <span className="flex-1 text-right text-sm font-medium text-foreground">
                        {section.label}
                      </span>
                      {section.completed ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          مكتمل
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Circle size={10} />
                          لم يكتمل
                        </span>
                      )}
                      <ChevronLeft size={16} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>

                {/* Progress */}
                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(completedCount / sections.length) * 100}%` }}
                    />
                  </div>
                  <span>{completedCount}/{sections.length} مكتمل</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mx-4 mt-6">
                <Button
                  onClick={() => { haptic.light(); setDeleteDrawer(true); }}
                  variant="outline"
                  className="w-full h-11 rounded-2xl gap-1.5 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 size={14} />
                  حذف الوصية بالكامل
                </Button>
              </div>
            </>
          )}

          <div className="h-8" />
        </PullToRefresh>
      )}

      {/* ── Section Editor Drawer ── */}
      <Drawer open={!!editingSection} onOpenChange={(open) => { if (!open) setEditingSection(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 justify-end">
              {editingSection?.label}
              <span className="text-xl">{editingSection?.icon}</span>
            </DrawerTitle>
            <DrawerDescription>اكتب محتوى هذا القسم من وصيتك</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <Textarea
              placeholder={`اكتب هنا محتوى "${editingSection?.label}"...`}
              value={sectionContent}
              onChange={(e) => setSectionContent(e.target.value)}
              className="min-h-[160px] rounded-xl text-right text-sm leading-relaxed resize-none"
              dir="rtl"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveSection}
                className="flex-1 h-12 rounded-xl text-sm font-bold gap-2"
              >
                <CheckCircle2 size={16} />
                حفظ
              </Button>
              <Button
                onClick={() => setEditingSection(null)}
                variant="outline"
                className="h-12 rounded-xl text-sm px-6"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Delete Will Drawer ── */}
      <Drawer open={deleteDrawer} onOpenChange={setDeleteDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>حذف الوصية</DrawerTitle>
            <DrawerDescription>هل أنت متأكد من حذف الوصية بالكامل؟</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-right">
              <p className="text-sm text-destructive font-medium mb-1">⚠️ تحذير</p>
              <p className="text-xs text-destructive/80 leading-relaxed">
                سيتم حذف جميع محتويات الوصية نهائياً دون إمكانية الاسترجاع.
                لن يتم عرض محتوى الوصية قبل الحذف.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteWill}
                variant="destructive"
                className="flex-1 h-12 rounded-xl text-sm font-bold gap-2"
              >
                <Trash2 size={16} />
                حذف نهائياً
              </Button>
              <Button
                onClick={() => setDeleteDrawer(false)}
                variant="outline"
                className="flex-1 h-12 rounded-xl text-sm font-bold"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Reset Password Drawer ── */}
      <Drawer open={resetStep !== null} onOpenChange={(open) => { if (!open) { setResetStep(null); setResetOtp(""); } }}>
        <DrawerContent>
          {resetStep === "confirm" && (
            <>
              <DrawerHeader>
                <DrawerTitle>إعادة تعيين كلمة المرور</DrawerTitle>
                <DrawerDescription>هذا الإجراء سيحذف الوصية بالكامل</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 space-y-4">
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-right">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-destructive font-bold">تحذير: لا يمكن التراجع</p>
                      <p className="text-xs text-destructive/80 leading-relaxed mt-1.5">
                        بما أن الوصية مشفّرة بكلمة المرور القديمة، فإن إعادة التعيين ستؤدي إلى:
                      </p>
                      <ul className="text-xs text-destructive/80 leading-relaxed mt-2 space-y-1 list-disc list-inside">
                        <li><strong>حذف الوصية بالكامل</strong> وكل ما كُتب فيها</li>
                        <li>لن يتمكن أحد من قراءة المحتوى المحذوف — أبداً</li>
                        <li>سيتم إرسال رمز تحقق لرقم جوالك لتأكيد العملية</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRequestReset}
                    disabled={resetLoading}
                    variant="destructive"
                    className="flex-1 h-12 rounded-xl text-sm font-bold gap-2"
                  >
                    {resetLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    إرسال رمز التحقق
                  </Button>
                  <Button
                    onClick={() => setResetStep(null)}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl text-sm font-bold"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            </>
          )}

          {resetStep === "otp" && (
            <>
              <DrawerHeader>
                <DrawerTitle>أدخل رمز التحقق</DrawerTitle>
                <DrawerDescription>تم إرسال رمز مكون من 6 أرقام لرقم جوالك</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 space-y-4">
                <div className="flex justify-center" dir="ltr">
                  <InputOTP maxLength={6} value={resetOtp} onChange={setResetOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  onClick={handleVerifyResetOtp}
                  disabled={resetOtp.length !== 6 || resetLoading}
                  variant="destructive"
                  className="w-full h-12 rounded-xl text-sm font-bold gap-2"
                >
                  {resetLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  تأكيد الحذف وإعادة التعيين
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Will;
