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
      <SheetContent side="right" className="w-80 p-0 border-none bg-background" style={{ direction: "rtl" }}>
        <div className="h-full flex flex-col">
          {/* Profile header */}
          <SheetHeader className="px-6 pt-10 pb-6 border-b border-border">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden bg-primary/10 border-[3px] border-primary/20">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">{user.name.charAt(0)}</span>
                )}
              </div>
              <SheetTitle className="text-foreground text-lg font-bold">{user.name}</SheetTitle>
              <span className="text-muted-foreground text-xs">{user.role === "parent" ? "ولي الأمر" : "فرد من الأسرة"}</span>
            </div>
          </SheetHeader>

          {/* Menu items */}
          <div className="flex-1 px-4 py-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right transition-colors bg-card hover:bg-muted active:bg-muted/80 border border-border/50"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProfileSheet;
