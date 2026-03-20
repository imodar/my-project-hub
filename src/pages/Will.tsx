import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock, KeyRound, Users, ChevronLeft, CheckCircle2, Circle,
  Shield, Home, Heart, Baby, Landmark, Leaf, Eye, EyeOff
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

// ── Section Data ──
interface WillSection {
  id: string;
  icon: string;
  label: string;
  completed: boolean;
}

const DEFAULT_SECTIONS: WillSection[] = [
  { id: "property", icon: "🏠", label: "توزيع الممتلكات", completed: true },
  { id: "messages", icon: "💌", label: "رسائل لأفراد العائلة", completed: true },
  { id: "guardian", icon: "👨‍👧‍👦", label: "الوصي على الأطفال", completed: true },
  { id: "charity", icon: "🕌", label: "الوصايا الخيرية", completed: false },
  { id: "funeral", icon: "🌿", label: "تعليمات الجنازة", completed: true },
];

const Will = () => {
  const navigate = useNavigate();
  const [sections] = useState<WillSection[]>(DEFAULT_SECTIONS);
  const [passwordDrawer, setPasswordDrawer] = useState(false);
  const [requestDrawer, setRequestDrawer] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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

  const completedCount = sections.filter((s) => s.completed).length;

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative pb-32">
      {/* Fixed Header */}
      <PageHeader title="الوصية" subtitle="وصيتك الشرعية محفوظة وآمنة" />

      <PullToRefresh onRefresh={handleRefresh} headerFixed>
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
          <p className="text-white/50 text-[10px] mt-2">
            متفق عليه
          </p>
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
                onClick={() => haptic.light()}
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

        {/* ── Bottom Actions ── */}
        <div className="mx-4 mt-6 space-y-3">
          <Button
            onClick={() => { haptic.light(); setPasswordDrawer(true); }}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground gap-2 text-sm font-bold"
          >
            <KeyRound size={18} />
            فتح وتعديل الوصية
          </Button>

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
                <p className="text-xs text-emerald-600 mt-1">
                  بانتظار موافقة جميع أفراد الأسرة
                </p>
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
    </div>
  );
};

export default Will;
