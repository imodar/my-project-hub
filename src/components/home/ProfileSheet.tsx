import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, Users, Settings, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    avatar?: string;
    role: "parent" | "child";
  };
}

const ProfileSheet = ({ open, onOpenChange, user }: ProfileSheetProps) => {
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: User,
      label: "ملفي الشخصي",
      desc: "الاسم والصورة الشخصية",
      onClick: () => {
        onOpenChange(false);
        navigate("/profile");
      },
    },
    ...(user.role === "parent"
      ? [
          {
            icon: Users,
            label: "إدارة أفراد الأسرة",
            desc: "إضافة أو إزالة أفراد العائلة",
            onClick: () => {
              onOpenChange(false);
              navigate("/family");
            },
          },
        ]
      : []),
    {
      icon: Settings,
      label: "الإعدادات",
      desc: "الإشعارات والمظهر واللغة",
      onClick: () => {
        onOpenChange(false);
        navigate("/settings");
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 p-0 border-none" style={{ direction: "rtl" }}>
        <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)) 40%, hsl(var(--background)) 40%)" }}>
          {/* Profile header */}
          <SheetHeader className="p-6 pb-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden" style={{
                background: user.avatar ? "transparent" : "hsla(0,0%,100%,0.15)",
                border: "3px solid hsla(0,0%,100%,0.3)",
              }}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">{user.name.charAt(0)}</span>
                )}
              </div>
              <SheetTitle className="text-white text-lg font-bold">{user.name}</SheetTitle>
              <span className="text-white/50 text-xs">{user.role === "parent" ? "ولي الأمر" : "فرد من الأسرة"}</span>
            </div>
          </SheetHeader>

          {/* Menu items */}
          <div className="flex-1 px-4 space-y-2 -mt-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right transition-colors active:bg-muted/80"
                style={{
                  background: "hsla(0,0%,100%,0.9)",
                  boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                  <item.icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>

          <div className="p-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProfileSheet;
