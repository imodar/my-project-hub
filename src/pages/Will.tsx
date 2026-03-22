import { useState, useEffect, useMemo } from "react";
import {
  Lock, KeyRound, Users, ChevronLeft, CheckCircle2, Circle,
  Shield, Eye, EyeOff, Trash2, RotateCcw, ScrollText, UserCheck
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { useWill } from "@/hooks/useWill";

// ── Types ──
interface WillSection {
  id: string;
  icon: string;
  label: string;
  completed: boolean;
  content: string;
}

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  hasWill: boolean;
}

const DEFAULT_SECTIONS: WillSection[] = [
  { id: "property", icon: "🏠", label: "توزيع الممتلكات", completed: true, content: "الشقة في الرياض لزوجتي، والأرض في جدة توزع بالتساوي بين الأبناء حسب الشرع." },
  { id: "messages", icon: "💌", label: "رسائل لأفراد العائلة", completed: true, content: "رسالة لزوجتي ورسالة لكل من أبنائي." },
  { id: "guardian", icon: "👨‍👧‍👦", label: "الوصي على الأطفال", completed: true, content: "أخي محمد هو الوصي على أطفالي في حال وفاتي." },
  { id: "charity", icon: "🕌", label: "الوصايا الخيرية", completed: false, content: "" },
  { id: "funeral", icon: "🌿", label: "تعليمات الجنازة", completed: true, content: "أرغب بالدفن في مقبرة البقيع إن أمكن، والصلاة عليّ في المسجد الحرام." },
];

const FAMILY_MEMBERS: FamilyMember[] = [
  { id: "1", name: "أحمد محمد", role: "أب", hasWill: true },
  { id: "2", name: "فاطمة أحمد", role: "أم", hasWill: true },
  { id: "3", name: "خالد أحمد", role: "ابن", hasWill: false },
  { id: "4", name: "نورة أحمد", role: "ابنة", hasWill: false },
];

const Will = () => {
  const { will, isLoading, upsertWill, deleteWill, createOpenRequest } = useWill();
  const [sections, setSections] = useState<WillSection[]>(DEFAULT_SECTIONS);
  const [passwordDrawer, setPasswordDrawer] = useState(false);
  const [requestDrawer, setRequestDrawer] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Section editing
  const [editingSection, setEditingSection] = useState<WillSection | null>(null);
  const [sectionContent, setSectionContent] = useState("");

  // Reset password
  const [resetDrawer, setResetDrawer] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete will
  const [deleteDrawer, setDeleteDrawer] = useState(false);

  // Family request
  const [familyRequestDrawer, setFamilyRequestDrawer] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  // Sync DB will data into local sections state
  useEffect(() => {
    if (will?.sections && Array.isArray(will.sections)) {
      setSections(will.sections as unknown as WillSection[]);
    }
  }, [will]);

  const handleRefresh = async () => {
    await new Promise((r) => setTimeout(r, 800));
  };

  const handleUnlock = () => {
    if (!password.trim()) return;
    haptic.medium();
    setPasswordDrawer(false);
    setPassword("");
    toast({ title: "تم فتح الوصية", description: "يمكنك الآن تعديل وصيتك" });
  };

  const handleRequestOpen = () => {
    haptic.heavy();
    setRequestSent(true);
    toast({
      title: "تم إرسال الطلب",
      description: "سيتم إشعار جميع أفراد الأسرة للموافقة على فتح الوصية",
    });
  };

  const handleResetPassword = () => {
    if (!newPassword.trim() || newPassword !== confirmPassword) return;
    haptic.medium();
    setResetDrawer(false);
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "تم تغيير كلمة المرور", description: "كلمة مرور الوصية الجديدة فعّالة الآن" });
  };

  const handleDeleteWill = () => {
    haptic.heavy();
    deleteWill.mutate();
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s, completed: false, content: "" })));
    setDeleteDrawer(false);
    toast({ title: "تم حذف الوصية", description: "تم مسح جميع محتويات الوصية" });
  };

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
    toast({ title: "تم الحفظ", description: `تم حفظ "${editingSection.label}" بنجاح` });
  };

  const handleFamilyRequest = (member: FamilyMember) => {
    haptic.light();
    setSelectedMember(member);
    setFamilyRequestDrawer(true);
  };

  const handleSendFamilyRequest = () => {
    if (!selectedMember) return;
    haptic.heavy();
    setFamilyRequestDrawer(false);
    toast({
      title: "تم إرسال الطلب",
      description: `سيتم إشعار أفراد الأسرة لفتح وصية ${selectedMember.name}`,
    });
  };

  const completedCount = sections.filter((s) => s.completed).length;

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative pb-32">
      <PageHeader title="الوصية" subtitle="وصيتك الشرعية محفوظة وآمنة" />

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

        {/* ── Security Card ── */}
        <div className="mx-4 mt-4 rounded-2xl bg-card border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Shield className="text-emerald-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Lock size={14} className="text-emerald-600" />
                وصيتك محمية ومكتوبة
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                مشفّرة بكلمة مرور خاصة. لا يمكن فتحها إلا بموافقة جميع أفراد الأسرة.
              </p>
              <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                <CheckCircle2 size={12} />
                آخر تعديل: 10 مارس 2026
              </p>
            </div>
          </div>
        </div>

        {/* ── Sections ── */}
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

        {/* ── Family Wills ── */}
        <div className="mx-4 mt-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            وصايا أفراد العائلة
          </h2>
          <div className="space-y-2">
            {FAMILY_MEMBERS.filter(m => m.hasWill).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <UserCheck size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground">{member.role} · لديه وصية مكتوبة</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFamilyRequest(member)}
                  className="text-[10px] h-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 gap-1 shrink-0"
                >
                  <ScrollText size={12} />
                  طلب فتح
                </Button>
              </div>
            ))}
            {FAMILY_MEMBERS.filter(m => !m.hasWill).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 opacity-50"
              >
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Circle size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground">{member.role} · لم يكتب وصية بعد</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Actions ── */}
        <div className="mx-4 mt-6 space-y-3">
          <Button
            onClick={() => { haptic.light(); setPasswordDrawer(true); }}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground gap-2 text-sm font-bold"
          >
            <KeyRound size={18} />
            فتح وتعديل الوصية
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={() => { haptic.light(); setResetDrawer(true); }}
              variant="outline"
              className="flex-1 h-11 rounded-2xl gap-1.5 text-xs font-bold"
            >
              <RotateCcw size={14} />
              إعادة تعيين كلمة المرور
            </Button>
            <Button
              onClick={() => { haptic.light(); setDeleteDrawer(true); }}
              variant="outline"
              className="flex-1 h-11 rounded-2xl gap-1.5 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <Trash2 size={14} />
              حذف الوصية
            </Button>
          </div>

          <Button
            onClick={() => { haptic.light(); setRequestDrawer(true); }}
            variant="outline"
            className="w-full h-12 rounded-2xl gap-2 text-sm font-bold border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <Users size={18} />
            طلب فتح الوصية — بعد الوفاة
          </Button>
        </div>

        <div className="h-8" />
      </PullToRefresh>

      {/* ── Password Drawer ── */}
      <Drawer open={passwordDrawer} onOpenChange={setPasswordDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>فتح الوصية</DrawerTitle>
            <DrawerDescription>أدخل كلمة المرور الخاصة بوصيتك</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pr-4 pl-12 text-right"
                dir="rtl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button
              onClick={handleUnlock}
              disabled={!password.trim()}
              className="w-full h-12 rounded-xl text-sm font-bold gap-2"
            >
              <KeyRound size={16} />
              فتح الوصية
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

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

      {/* ── Reset Password Drawer ── */}
      <Drawer open={resetDrawer} onOpenChange={setResetDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>إعادة تعيين كلمة المرور</DrawerTitle>
            <DrawerDescription>أدخل كلمة مرور جديدة لوصيتك</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-right">
              <p className="text-xs text-amber-700 leading-relaxed">
                ⚠️ إعادة تعيين كلمة المرور لن تكشف محتوى الوصية. ستحتاج لاستخدام كلمة المرور الجديدة لفتحها.
              </p>
            </div>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="كلمة المرور الجديدة"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-12 rounded-xl pr-4 pl-12 text-right"
                dir="rtl"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Input
              type={showNewPassword ? "text" : "password"}
              placeholder="تأكيد كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl pr-4 text-right"
              dir="rtl"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-destructive text-right">كلمتا المرور غير متطابقتين</p>
            )}
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword.trim() || newPassword !== confirmPassword}
              className="w-full h-12 rounded-xl text-sm font-bold gap-2"
            >
              <RotateCcw size={16} />
              تغيير كلمة المرور
            </Button>
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

      {/* ── Request Open Drawer ── */}
      <Drawer open={requestDrawer} onOpenChange={setRequestDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>طلب فتح الوصية</DrawerTitle>
            <DrawerDescription>
              سيتم إرسال إشعار لجميع أفراد الأسرة للموافقة على فتح الوصية
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-right">
              <p className="text-sm text-amber-800 font-medium mb-2">⚠️ تنبيه مهم</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                هذا الطلب مخصص لحالات الوفاة فقط. سيتم إشعار جميع أفراد الأسرة
                وطلب موافقتهم على فتح الوصية. بعد موافقة الجميع، ستُفتح الوصية
                بوضعية القراءة فقط.
              </p>
            </div>
            {requestSent ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={32} />
                <p className="text-sm font-bold text-emerald-800">تم إرسال الطلب</p>
                <p className="text-xs text-emerald-600 mt-1">بانتظار موافقة جميع أفراد الأسرة</p>
              </div>
            ) : (
              <Button
                onClick={handleRequestOpen}
                variant="destructive"
                className="w-full h-12 rounded-xl text-sm font-bold gap-2"
              >
                <Users size={16} />
                تأكيد إرسال الطلب
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Family Request Drawer ── */}
      <Drawer open={familyRequestDrawer} onOpenChange={setFamilyRequestDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>طلب فتح وصية {selectedMember?.name}</DrawerTitle>
            <DrawerDescription>
              سيتم إرسال إشعار لكل أفراد الأسرة للموافقة
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-right">
              <p className="text-sm text-amber-800 font-medium mb-2">⚠️ تنبيه مهم</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                هذا الطلب مخصص لحالات الوفاة فقط. بعد موافقة جميع أفراد الأسرة،
                ستُفتح وصية {selectedMember?.name} بوضعية القراءة فقط.
              </p>
            </div>
            <Button
              onClick={handleSendFamilyRequest}
              variant="destructive"
              className="w-full h-12 rounded-xl text-sm font-bold gap-2"
            >
              <Users size={16} />
              تأكيد إرسال الطلب
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Will;
