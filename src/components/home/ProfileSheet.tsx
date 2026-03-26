import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, Users, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    avatar?: string;
    role: "parent" | "child";
  };
}

const ProfileSheet = React.forwardRef<HTMLDivElement, ProfileSheetProps>(
  ({ open, onOpenChange, user }, ref) => {
    const navigate = useNavigate();
    const { t, dir, isRTL } = useLanguage();

    const menuItems = [
      {
        icon: User,
        label: t.profile.myProfile,
        desc: t.profile.profileDesc,
        onClick: () => {
          onOpenChange(false);
          navigate("/profile");
        },
      },
      ...(user.role === "parent"
        ? [
            {
              icon: Users,
              label: t.profile.familyManagement,
              desc: t.profile.familyManagementDesc,
              onClick: () => {
                onOpenChange(false);
                navigate("/family");
              },
            },
          ]
        : []),
      {
        icon: Settings,
        label: t.nav.settings,
        desc: t.profile.settingsDesc,
        onClick: () => {
          onOpenChange(false);
          navigate("/settings");
        },
      },
    ];

    return (
      <div ref={ref}>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side={isRTL ? "right" : "left"} className="w-80 p-0 border-none bg-background" style={{ direction: dir }}>
            <div className="h-full flex flex-col">
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
                  <span className="text-muted-foreground text-xs">{user.role === "parent" ? t.profile.parent : t.profile.familyMember}</span>
                </div>
              </SheetHeader>

              <div className="flex-1 px-4 py-4 space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl ${isRTL ? "text-right" : "text-left"} transition-colors bg-card hover:bg-muted active:bg-muted/80 border border-border/50`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                      <item.icon size={18} className="text-primary" />
                    </div>
                    <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    {isRTL ? <ChevronLeft size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }
);

ProfileSheet.displayName = "ProfileSheet";

export default ProfileSheet;
