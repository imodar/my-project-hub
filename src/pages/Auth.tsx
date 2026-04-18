import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ptmhrfovbyvpewfdpejf.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0bWhyZm92Ynl2cGV3ZmRwZWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjkyNzAsImV4cCI6MjA4OTc0NTI3MH0.0q-1UB9WZhmFCOXudEJ6lCUYW1ZTzC6yRUkftD6tC1Y";

async function callPhoneAuth(payload: Record<string, string>) {
  const url = `${SUPABASE_URL}/functions/v1/phone-auth`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `خطأ ${response.status}`);
  if (data?.error) throw new Error(data.error);
  return data;
}
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { appToast } from "@/lib/toast";
import { Phone, ArrowRight, Loader2, Globe, ChevronDown, Mail } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import authFamily from "@/assets/auth-family.webp";
import LanguageSheet from "@/components/LanguageSheet";
import LegalPageSheet from "@/components/LegalPageSheet";

type Step = "phone" | "otp";

const COUNTRIES = [
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "السعودية" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "الإمارات" },
  { code: "KW", dial: "+965", flag: "🇰🇼", name: "الكويت" },
  { code: "BH", dial: "+973", flag: "🇧🇭", name: "البحرين" },
  { code: "QA", dial: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "OM", dial: "+968", flag: "🇴🇲", name: "عُمان" },
  { code: "JO", dial: "+962", flag: "🇯🇴", name: "الأردن" },
  { code: "EG", dial: "+20", flag: "🇪🇬", name: "مصر" },
  { code: "LB", dial: "+961", flag: "🇱🇧", name: "لبنان" },
  { code: "YE", dial: "+967", flag: "🇾🇪", name: "اليمن" },
  { code: "IQ", dial: "+964", flag: "🇮🇶", name: "العراق" },
  { code: "SY", dial: "+963", flag: "🇸🇾", name: "سوريا" },
  { code: "SD", dial: "+249", flag: "🇸🇩", name: "السودان" },
  { code: "LY", dial: "+218", flag: "🇱🇾", name: "ليبيا" },
  { code: "TN", dial: "+216", flag: "🇹🇳", name: "تونس" },
  { code: "DZ", dial: "+213", flag: "🇩🇿", name: "الجزائر" },
  { code: "MA", dial: "+212", flag: "🇲🇦", name: "المغرب" },
  { code: "TR", dial: "+90", flag: "🇹🇷", name: "تركيا" },
  { code: "PK", dial: "+92", flag: "🇵🇰", name: "باكستان" },
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "الهند" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "بريطانيا" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "الولايات المتحدة" },
];

const Auth = () => {
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [privacySheet, setPrivacySheet] = useState(false);
  const [termsSheet, setTermsSheet] = useState(false);
  const { session } = useAuth();
  const { t, language, setLanguage, dir, isRTL } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryDrawer, setShowCountryDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const fullPhone = phone.startsWith("+") ? phone : `${selectedCountry.dial}${phone.replace(/^0/, "")}`;

  const sendOtp = async (animate = true) => {
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      appToast.error("أدخل رقم جوال صحيح");
      return;
    }
    if (animate) setSending(true);
    setLoading(true);
    try {
      const data = await callPhoneAuth({ action: "send-otp", phone: fullPhone });

      // Wait for fly-away animation to feel complete before switching step
      if (animate) {
        await new Promise((r) => setTimeout(r, 1600));
      }

      appToast.info("تم إرسال رمز التحقق", `إلى ${fullPhone}`);
      setStep("otp");
      setCountdown(60);
    } catch (err: any) {
      appToast.error("خطأ في إرسال الرمز", err.message);
    } finally {
      setLoading(false);
      setSending(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const data = await callPhoneAuth({ action: "verify-otp", phone: fullPhone, code });

      // verifyOtp من client SDK — ينشئ الجلسة تلقائياً
      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (error) throw error;

      appToast.success("تم الدخول بنجاح ✓");
    } catch (err: any) {
      appToast.error("رمز التحقق غير صحيح", err.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      appToast.error("خطأ في تسجيل الدخول", err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6 && step === "otp") verifyOtp(otp);
  }, [otp]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (session) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary via-primary/90 to-primary/70" dir={dir} style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Top area - branding (1/3 of screen) */}
      <div className="h-[33vh] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-primary-foreground mb-2">{t.auth.appTitle}</h1>
          <p className="text-primary-foreground/70 text-sm">{t.auth.appSubtitle}</p>
        </motion.div>
        <motion.img
          src={authFamily}
          alt={isRTL ? "عائلة" : "Family"}
          className="h-28 mt-3 object-contain pointer-events-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.2 },
            scale: { duration: 0.5, delay: 0.2 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="bg-background rounded-t-[2rem] px-6 pt-8 pb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] min-h-[67vh] flex flex-col"
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-6" />

        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-5 flex-1 flex flex-col"
            >
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-foreground">{t.auth.welcome}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t.auth.loginWithPhone}</p>
              </div>

              {/* Phone input */}
              <div className="relative" dir="ltr">
                <button
                  type="button"
                  onClick={() => setShowCountryDrawer(true)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-base">{selectedCountry.flag}</span>
                  <span>{selectedCountry.dial}</span>
                  <ChevronDown size={12} />
                </button>
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="5XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phone.replace(/\D/g, "").length >= 9) sendOtp();
                  }}
                  className="pl-[5.5rem] text-left h-14 rounded-xl bg-secondary/50 border-border/50 text-base"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <div className="relative h-14 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!sending ? (
                    <motion.div
                      key="btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, width: "100%" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="w-full"
                    >
                      <Button
                        onClick={() => sendOtp()}
                        disabled={loading || phone.replace(/\D/g, "").length < 9}
                        className="w-full h-14 rounded-xl text-base font-semibold gap-2 shadow-md active:scale-[0.97] transition-transform"
                      >
                        <Phone className="h-5 w-5" />
                        {t.auth.sendOtp}
                      </Button>
                    </motion.div>
                  ) : (() => {
                    // Pick an upper corner of the blue area above the white sheet
                    const goLeft = Math.random() < 0.5;
                    // Incomplete-circle orbit (≈ 280°) then a straight dart to the corner
                    // Orbit center is slightly above the button
                    const R = 26; // small orbit radius — looks like a hovering fly
                    const orbitSteps = 8;
                    const startAngle = Math.PI / 2; // start at bottom of orbit (button position)
                    const sweep = (280 * Math.PI) / 180; // incomplete circle
                    const dir = goLeft ? -1 : 1;
                    const orbitX: number[] = [];
                    const orbitY: number[] = [];
                    for (let i = 0; i <= orbitSteps; i++) {
                      const a = startAngle + dir * (sweep * (i / orbitSteps));
                      orbitX.push(Math.cos(a) * R);
                      orbitY.push(-R + Math.sin(a) * R); // shift so orbit sits just above button
                    }
                    // Final straight-line dart to corner of blue area
                    const cornerX = goLeft ? -170 : 170;
                    const cornerY = -360;
                    const xPath = [0, ...orbitX, cornerX];
                    const yPath = [0, ...orbitY, cornerY];
                    const n = xPath.length;
                    const times = xPath.map((_, i) => i / (n - 1));
                    const opacityPath = xPath.map((_, i) =>
                      i === 0 ? 1 : i < n - 1 ? 1 : 0
                    );
                    const scalePath = xPath.map((_, i) =>
                      i === 0 ? 1 : i < n - 1 ? 1 : 0.4
                    );
                    return (
                    <motion.div
                      key="circle"
                      initial={{ width: "100%", borderRadius: "0.75rem" }}
                      animate={{
                        width: 56,
                        borderRadius: "9999px",
                        x: xPath,
                        y: yPath,
                        opacity: opacityPath,
                        scale: scalePath,
                      }}
                      transition={{
                        width: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                        borderRadius: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                        x: { duration: 1.5, times, ease: "linear", delay: 0.25 },
                        y: { duration: 1.5, times, ease: "linear", delay: 0.25 },
                        opacity: { duration: 1.5, times, delay: 0.25 },
                        scale: { duration: 1.5, times, delay: 0.25, ease: "easeIn" },
                      }}
                      className="h-14 bg-primary text-primary-foreground shadow-lg flex items-center justify-center overflow-hidden"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.15, 1] }}
                        transition={{ duration: 0.4, times: [0, 0.7, 1], ease: "easeOut" }}
                      >
                        <Mail className="h-5 w-5" />
                      </motion.div>
                    </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">{t.auth.orLoginWith}</span>
                </div>
              </div>

              {/* Google button */}
              <Button
                variant="outline"
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full h-14 rounded-xl text-base gap-3 border-border/50 active:scale-[0.97] transition-transform"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </Button>

              <div className="flex-1" />

              {/* Language switch + Terms */}
              <div className="flex flex-col items-center gap-3 pt-2 pb-2">
                <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                  <button
                    type="button"
                    onClick={() => setLangSheetOpen(true)}
                    className="inline-flex items-baseline gap-1 text-muted-foreground/80 hover:text-foreground transition-colors mx-1"
                  >
                    <Globe className="h-3.5 w-3.5 relative top-[2px]" />
                    <span className="underline underline-offset-2 text-[11px] font-medium">
                      {language === "ar" ? "العربية" : "English"}
                    </span>
                  </button>
                  {" — "}
                   {t.auth.termsText}{" "}
                   <button type="button" onClick={() => setTermsSheet(true)} className="underline underline-offset-2 text-muted-foreground/80 hover:text-foreground transition-colors">{t.auth.termsLink}</button>{" "}
                   {t.auth.andPrivacy}{" "}
                   <button type="button" onClick={() => setPrivacySheet(true)} className="underline underline-offset-2 text-muted-foreground/80 hover:text-foreground transition-colors">{t.auth.privacyLink}</button>{" "}
                   {t.auth.termsEnd}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground">{t.auth.otpTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.auth.otpSentTo}{" "}
                  <span dir="ltr" className="font-mono text-foreground">{fullPhone}</span>
                </p>
              </div>

              <div className="flex justify-center" dir="ltr">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus inputMode="numeric" pattern="[0-9]*">
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

              {loading && (
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    abortRef.current?.abort();
                    setStep("phone");
                    setOtp("");
                  }}
                  className="gap-1 text-muted-foreground"
                >
                  <ArrowRight className={`h-3 w-3 ${!isRTL ? 'rotate-180' : ''}`} />
                  {t.auth.changeNumber}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => sendOtp()}
                  disabled={countdown > 0 || loading}
                  className="text-muted-foreground"
                >
                  {countdown > 0 ? `${t.auth.resendIn} (${countdown})` : t.auth.resend}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <LanguageSheet open={langSheetOpen} onOpenChange={setLangSheetOpen} />
      <LegalPageSheet open={termsSheet} onOpenChange={setTermsSheet} slug="terms-of-service" />
      <LegalPageSheet open={privacySheet} onOpenChange={setPrivacySheet} slug="privacy-policy" />

      <Drawer open={showCountryDrawer} onOpenChange={setShowCountryDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-right">اختر الدولة</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { setSelectedCountry(c); setShowCountryDrawer(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted transition-colors ${selectedCountry.code === c.code ? "bg-primary/5" : ""}`}
              >
                <span className="text-2xl">{c.flag}</span>
                <span className="flex-1 text-foreground">{c.name}</span>
                <span className="text-muted-foreground text-sm" dir="ltr">{c.dial}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Auth;
