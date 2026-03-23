import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Phone, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import authFamily from "@/assets/auth-family.png";

type Step = "phone" | "otp";

const Auth = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const fullPhone = phone.startsWith("+") ? phone : `+966${phone.replace(/^0/, "")}`;
  const isTestNumber = fullPhone === "+966539998666";

  const sendOtp = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "أدخل رقم جوال صحيح", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (isTestNumber) {
        const res = await supabase.functions.invoke("test-login", {
          body: { phone: fullPhone },
        });
        if (res.error) throw res.error;
        const { access_token, refresh_token } = res.data;
        if (!access_token) throw new Error(res.data?.error || "فشل الدخول التجريبي");
        await supabase.auth.setSession({ access_token, refresh_token });
        toast({ title: "تم الدخول بنجاح ✓" });
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      setStep("otp");
      setCountdown(60);
      toast({ title: "تم إرسال رمز التحقق" });
      tryWebOtp();
    } catch (err: any) {
      toast({ title: "خطأ في إرسال الرمز", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const tryWebOtp = async () => {
    if (!("OTPCredential" in window)) return;
    try {
      abortRef.current = new AbortController();
      const content = await navigator.credentials.get({
        // @ts-ignore
        otp: { transport: ["sms"] },
        signal: abortRef.current.signal,
      });
      if (content && "code" in content) {
        setOtp((content as any).code);
      }
    } catch {}
  };

  const verifyOtp = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: code, type: "sms" });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "رمز التحقق غير صحيح", description: err.message, variant: "destructive" });
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
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary via-primary/90 to-primary/70" dir="rtl">
      {/* Top area - branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-primary-foreground mb-2">عِلتي</h1>
          <p className="text-primary-foreground/70 text-sm">نظّم حياة عائلتك في مكان واحد</p>
        </motion.div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="bg-background rounded-t-[2rem] px-6 pt-8 pb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
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
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-foreground">أهلاً بك</h2>
                <p className="text-sm text-muted-foreground mt-1">سجّل دخولك برقم الجوال</p>
              </div>

              {/* Phone input */}
              <div className="relative" dir="ltr">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-muted-foreground select-none">
                  <span className="text-base">🇸🇦</span>
                  <span>+966</span>
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="5XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                  className="pl-[5.5rem] text-left h-14 rounded-xl bg-secondary/50 border-border/50 text-base"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <Button
                onClick={sendOtp}
                disabled={loading || phone.replace(/\D/g, "").length < 9}
                className="w-full h-14 rounded-xl text-base font-semibold gap-2 shadow-md active:scale-[0.97] transition-transform"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-5 w-5" />
                    إرسال رمز التحقق
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">أو سجّل دخول بواسطة</span>
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

              {/* Terms */}
              <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed pt-2 pb-2">
                بتسجيل دخولك تكون قد وافقت على{" "}
                <span className="underline underline-offset-2 text-muted-foreground/80">الشروط والأحكام</span>{" "}
                الخاصة بالتطبيق
              </p>
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
                <h2 className="text-xl font-bold text-foreground">رمز التحقق</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  أدخل الرمز المرسل إلى{" "}
                  <span dir="ltr" className="font-mono text-foreground">{fullPhone}</span>
                </p>
              </div>

              <div className="flex justify-center" dir="ltr">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
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
                  <ArrowRight className="h-3 w-3" />
                  تغيير الرقم
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={sendOtp}
                  disabled={countdown > 0 || loading}
                  className="text-muted-foreground"
                >
                  {countdown > 0 ? `إعادة الإرسال (${countdown})` : "إعادة الإرسال"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
