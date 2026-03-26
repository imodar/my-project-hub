import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import ar, { type Translations } from "@/i18n/ar";
import en from "@/i18n/en";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  dir: "rtl" | "ltr";
  isRTL: boolean;
}

const translations: Record<Language, Translations> = { ar, en };

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  setLanguage: () => {},
  t: ar,
  dir: "rtl",
  isRTL: true,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("app_language");
    return (stored === "en" ? "en" : "ar") as Language;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  const dir = language === "ar" ? "rtl" : "ltr";
  const isRTL = language === "ar";

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language);
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language], dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};
