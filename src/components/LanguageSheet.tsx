import { useLanguage } from "@/contexts/LanguageContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check } from "lucide-react";
import { appToast } from "@/lib/toast";

interface LanguageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LanguageSheet = ({ open, onOpenChange }: LanguageSheetProps) => {
  const { language, setLanguage, t, dir, isRTL } = useLanguage();

  const handleLanguageChange = (lang: "ar" | "en") => {
    setLanguage(lang);
    onOpenChange(false);
    appToast.success(t.settings.languageChanged);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-none" style={{ direction: dir }}>
        <div className="flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className={`text-foreground text-lg font-bold ${isRTL ? "text-right" : "text-left"}`}>
              {t.settings.selectLanguage}
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 py-5 space-y-3" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
            {[
              { code: "ar" as const, label: "العربية", desc: "Arabic", flag: "🇸🇦" },
              { code: "en" as const, label: "English", desc: "الإنجليزية", flag: "🇺🇸" },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-colors active:scale-[0.98] ${
                  language === lang.code
                    ? "bg-primary/10 border-2 border-primary/30"
                    : "bg-card border border-border/50 hover:bg-muted"
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                  <p className="text-sm font-bold text-foreground">{lang.label}</p>
                  <p className="text-xs text-muted-foreground">{lang.desc}</p>
                </div>
                {language === lang.code && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check size={14} className="text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LanguageSheet;
