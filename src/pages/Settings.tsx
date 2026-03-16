import { useNavigate } from "react-router-dom";
import { ChevronRight, Bell, Moon, Globe, Info, Shield, Trash2 } from "lucide-react";

const settingsGroups = [
  {
    title: "عام",
    items: [
      { icon: Bell, label: "الإشعارات", desc: "إدارة التنبيهات والإشعارات", path: "" },
      { icon: Moon, label: "المظهر", desc: "الوضع الداكن والمظهر العام", path: "" },
      { icon: Globe, label: "اللغة", desc: "العربية", path: "" },
    ],
  },
  {
    title: "حول التطبيق",
    items: [
      { icon: Info, label: "عن التطبيق", desc: "الإصدار 1.0.0", path: "" },
      { icon: Shield, label: "سياسة الخصوصية", desc: "", path: "" },
    ],
  },
  {
    title: "أخرى",
    items: [
      { icon: Trash2, label: "مسح البيانات", desc: "حذف جميع البيانات المحفوظة", path: "", danger: true },
    ],
  },
];

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen max-w-md mx-auto flex flex-col"
      style={{
        background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 95%) 100%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div />
        <h1 className="text-lg font-bold text-foreground">الإعدادات</h1>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground"
          style={{ background: "hsla(0,0%,0%,0.05)" }}
        >
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Settings Groups */}
      <div className="flex-1 px-4 pb-8 space-y-6">
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
    </div>
  );
};

export default Settings;
