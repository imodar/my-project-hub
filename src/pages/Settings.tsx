import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Bell, Moon, Globe, Info, Shield, Trash2, BookOpen, Archive, ShieldAlert, Phone, UserX, Volume2, MapPin, Lock, User, Briefcase, Car } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import { useUserRole, type UserRole } from "@/contexts/UserRoleContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";


const emergencyContacts = [
  { id: "1", name: "الجد أبو محمد", phone: "+966 50 123 4567" },
  { id: "2", name: "العم خالد", phone: "+966 55 987 6543" },
];

const familyMembers = [
  { id: "1", name: "أحمد", sosEnabled: true },
  { id: "2", name: "سارة", sosEnabled: true },
  { id: "3", name: "يوسف", sosEnabled: false },
];

const Settings = () => {
  const navigate = useNavigate();
  const { islamicMode, setIslamicMode } = useIslamicMode();
  const { currentRole, setCurrentRole } = useUserRole();
  const [emergencySheetOpen, setEmergencySheetOpen] = useState(false);
  const [contacts, setContacts] = useState(emergencyContacts);
  const [members, setMembers] = useState(familyMembers);
  const [emergencySound, setEmergencySound] = useState(true);
  const [liveTracking, setLiveTracking] = useState(true);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  // Simulate admin role (parent)
  const isAdmin = true;

  const settingsGroups = [
    {
      title: "عام",
      items: [
        { icon: Bell, label: "الإشعارات", desc: "إدارة التنبيهات والإشعارات" },
        { icon: Moon, label: "المظهر", desc: "الوضع الداكن والمظهر العام" },
        { icon: Globe, label: "اللغة", desc: "العربية" },
      ],
    },
    {
      title: "حول التطبيق",
      items: [
        { icon: Info, label: "عن التطبيق", desc: "الإصدار 1.0.0" },
        { icon: Shield, label: "سياسة الخصوصية", desc: "" },
      ],
    },
    {
      title: "أخرى",
      items: [
        { icon: Archive, label: "سلة المحذوفات", desc: "استعادة أو حذف العناصر نهائياً", onClick: () => navigate("/trash") },
        { icon: Trash2, label: "مسح البيانات", desc: "حذف جميع البيانات المحفوظة", danger: true },
      ],
    },
  ];

  const handleAddContact = () => {
    if (newContactName.trim() && newContactPhone.trim()) {
      setContacts(prev => [...prev, { id: Date.now().toString(), name: newContactName, phone: newContactPhone }]);
      setNewContactName("");
      setNewContactPhone("");
      setAddContactOpen(false);
    }
  };

  const handleRemoveContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const toggleMemberSOS = (id: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, sosEnabled: !m.sosEnabled } : m));
  };

  return (
    <div
      className="min-h-screen max-w-2xl mx-auto flex flex-col"
      style={{
        background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 95%) 100%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground"
          style={{ background: "hsla(0,0%,0%,0.05)" }}
        >
          رجوع
          <ChevronRight size={18} />
        </button>
        <h1 className="text-lg font-bold text-foreground">الإعدادات</h1>
        <div />
      </div>

      {/* Settings */}
      <div className="flex-1 px-4 pb-8 space-y-6">

        {/* Emergency Settings - Admin Only */}
        {isAdmin && (
          <div>
            <h2 className="text-xs font-semibold mb-2 px-1" style={{ color: "hsl(0, 72%, 51%)" }}>
              🚨 إعدادات الطوارئ
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, hsl(0, 84%, 97%), hsl(0, 60%, 95%))",
                boxShadow: "0 2px 16px hsla(0, 72%, 51%, 0.12)",
                border: "1px solid hsla(0, 72%, 51%, 0.15)",
              }}
            >
              {/* Main emergency settings button */}
              <button
                onClick={() => setEmergencySheetOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-4 text-right transition-colors active:bg-red-100/50"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
                    boxShadow: "0 3px 10px hsla(0, 72%, 51%, 0.3)",
                  }}
                >
                  <ShieldAlert size={20} className="text-white" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-bold" style={{ color: "hsl(0, 72%, 40%)" }}>
                    إعدادات نظام الطوارئ
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(0, 40%, 55%)" }}>
                    أرقام الطوارئ، التتبع، وإدارة صلاحيات الأفراد
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: "hsl(0, 50%, 60%)" }} className="rotate-180" />
              </button>

              {/* Quick info */}
              <div className="px-4 py-2.5 flex items-center gap-2 border-t" style={{ borderColor: "hsla(0, 72%, 51%, 0.1)" }}>
                <Lock size={12} style={{ color: "hsl(0, 50%, 55%)" }} />
                <p className="text-[11px]" style={{ color: "hsl(0, 40%, 55%)" }}>
                  متاح فقط للمشرفين (الأب والأم)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Islamic Mode Toggle */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">الوضع</h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "hsla(0,0%,100%,0.9)",
              boxShadow: "0 2px 12px hsla(0,0%,0%,0.05)",
            }}
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3.5 text-right cursor-pointer"
              onClick={() => setIslamicMode(!islamicMode)}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "hsl(145, 40%, 42%, 0.1)" }}
              >
                <BookOpen size={18} style={{ color: "hsl(145, 40%, 42%)" }} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold text-foreground">الوضع الإسلامي</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {islamicMode ? "يعرض القرآن والأذكار والمسبحة والصلاة والقبلة" : "يعرض السوق والتقويم والديون"}
                </p>
              </div>
              <div
                className={`relative h-6 w-11 rounded-full transition-colors ${islamicMode ? "bg-primary" : "bg-input"}`}
                style={{ direction: "ltr" }}
                aria-hidden="true"
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${islamicMode ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Role Switcher (Demo) */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">محاكاة الدور (للتجربة)</h2>
          <div
            className="rounded-2xl overflow-hidden p-4"
            style={{
              background: "hsla(0,0%,100%,0.9)",
              boxShadow: "0 2px 12px hsla(0,0%,0%,0.05)",
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {([
                { role: "father" as UserRole, label: "أب", icon: User, color: "hsl(var(--primary))" },
                { role: "son" as UserRole, label: "ابن", icon: User, color: "hsl(215, 70%, 50%)" },
                { role: "worker" as UserRole, label: "عامل", icon: Briefcase, color: "hsl(30, 60%, 45%)" },
                { role: "maid" as UserRole, label: "عاملة", icon: Briefcase, color: "hsl(30, 60%, 45%)" },
                { role: "driver" as UserRole, label: "سائق", icon: Car, color: "hsl(30, 60%, 45%)" },
              ]).map((item) => (
                <button
                  key={item.role}
                  onClick={() => setCurrentRole(item.role)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    currentRole === item.role ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <item.icon size={18} style={{ color: currentRole === item.role ? item.color : "hsl(var(--muted-foreground))" }} />
                  <span className="text-xs font-bold text-foreground">{item.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              اختر دوراً لمحاكاة تجربة المستخدم المختلفة
            </p>
          </div>
        </div>

        {/* Other Settings Groups */}
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              {group.title}
            </h2>
            <div
              className="rounded-2xl overflow-hidden divide-y divide-border"
              style={{
                background: "hsla(0,0%,100%,0.9)",
                boxShadow: "0 2px 12px hsla(0,0%,0%,0.05)",
              }}
            >
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={(item as any).onClick}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-right transition-colors active:bg-muted/50"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: (item as any).danger
                        ? "hsl(0, 84%, 60%, 0.1)"
                        : "hsl(var(--primary) / 0.1)",
                    }}
                  >
                    <item.icon
                      size={18}
                      className={(item as any).danger ? "text-destructive" : "text-primary"}
                    />
                  </div>
                  <div className="flex-1 text-right">
                    <p className={`text-sm font-semibold ${(item as any).danger ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    {item.desc && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground rotate-180" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Emergency Settings Sheet */}
      <Sheet open={emergencySheetOpen} onOpenChange={setEmergencySheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 border-none" style={{ direction: "rtl" }}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Sheet Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
                  }}
                >
                  <ShieldAlert size={20} className="text-white" />
                </div>
                <div>
                  <SheetTitle className="text-foreground text-lg font-bold text-right">إعدادات الطوارئ</SheetTitle>
                  <p className="text-xs text-muted-foreground text-right">تخصيص نظام الطوارئ والتنبيهات</p>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Emergency Contacts */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Phone size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  أرقام الطوارئ الخارجية
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  أشخاص من خارج العائلة يتم إرسال SMS لهم عند تفعيل الطوارئ
                </p>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "hsla(0, 72%, 51%, 0.05)", border: "1px solid hsla(0, 72%, 51%, 0.1)" }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "hsla(0, 72%, 51%, 0.1)" }}>
                        <Phone size={14} style={{ color: "hsl(0, 72%, 51%)" }} />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                        <p className="text-xs text-muted-foreground" style={{ direction: "ltr", textAlign: "right" }}>{contact.phone}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95"
                        style={{ background: "hsla(0, 72%, 51%, 0.1)" }}
                      >
                        <Trash2 size={14} style={{ color: "hsl(0, 72%, 51%)" }} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Contact */}
                {addContactOpen ? (
                  <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: "hsla(0,0%,0%,0.03)", border: "1px dashed hsla(0,0%,0%,0.1)" }}>
                    <input
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      placeholder="الاسم"
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border text-right focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <input
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      placeholder="رقم الهاتف"
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border text-right focus:outline-none focus:ring-2 focus:ring-red-300"
                      style={{ direction: "ltr", textAlign: "right" }}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddContact}
                        className="flex-1 rounded-xl h-10 text-sm font-bold"
                        style={{ background: "hsl(0, 72%, 51%)", color: "white" }}
                      >
                        إضافة
                      </Button>
                      <Button
                        onClick={() => { setAddContactOpen(false); setNewContactName(""); setNewContactPhone(""); }}
                        variant="outline"
                        className="flex-1 rounded-xl h-10 text-sm"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddContactOpen(true)}
                    className="w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
                    style={{ border: "2px dashed hsla(0, 72%, 51%, 0.25)", color: "hsl(0, 72%, 51%)" }}
                  >
                    + إضافة رقم طوارئ
                  </button>
                )}
              </div>

              {/* Toggle Settings */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Volume2 size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  إعدادات التنبيه
                </h3>
                <div className="space-y-1 rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Volume2 size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">صوت تنبيه مميز</p>
                        <p className="text-xs text-muted-foreground">صوت مختلف عن باقي الإشعارات</p>
                      </div>
                    </div>
                    <Switch checked={emergencySound} onCheckedChange={setEmergencySound} />
                  </div>
                  <div className="h-px bg-border mx-4" />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">تتبع الموقع المباشر</p>
                        <p className="text-xs text-muted-foreground">تحديث الموقع كل 30 ثانية عند التفعيل</p>
                      </div>
                    </div>
                    <Switch checked={liveTracking} onCheckedChange={setLiveTracking} />
                  </div>
                </div>
              </div>

              {/* Member SOS Permissions */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <UserX size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  صلاحيات زر الطوارئ
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  تعطيل أو تفعيل زر الطوارئ لكل فرد
                </p>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
                          <span className="text-xs font-bold text-primary">{member.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.sosEnabled ? "زر الطوارئ مفعّل" : "زر الطوارئ معطّل"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={member.sosEnabled}
                        onCheckedChange={() => toggleMemberSOS(member.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Settings;
