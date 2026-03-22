import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Phone, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

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

  // Redirect if already authenticated
  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const fullPhone = phone.startsWith("+") ? phone : `+966${phone.replace(/^0/, "")}`;

  const sendOtp = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "أدخل رقم جوال صحيح", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;

      setStep("otp");
      setCountdown(60);
      toast({ title: "تم إرسال رمز التحقق" });

      // WebOTP: auto-read SMS code
      tryWebOtp();
    } catch (err: any) {
      toast({
        title: "خطأ في إرسال الرمز",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const tryWebOtp = async () => {
    if (!("OTPCredential" in window)) return;
    try {
      abortRef.current = new AbortController();
      const content = await navigator.credentials.get({
        // @ts-ignore — WebOTP API
        otp: { transport: ["sms"] },
        signal: abortRef.current.signal,
      });
      if (content && "code" in content) {
        setOtp((content as any).code);
      }
    } catch {
      // User dismissed or unsupported — silent fallback
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: code,
        type: "sms",
      });
      if (error) throw error;
      // Auth state listener in AuthContext handles navigation
    } catch (err: any) {
      toast({
        title: "رمز التحقق غير صحيح",
        description: err.message,
        variant: "destructive",
      });
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
      toast({
        title: "خطأ في تسجيل الدخول",
        description: err.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      verifyOtp(otp);
    }
  }, [otp]);

  // Cleanup WebOTP abort
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (session) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">عِلتي</h1>
          <p className="text-muted-foreground text-sm">
            {step === "phone" ? "سجّل دخولك برقم الجوال" : "أدخل رمز التحقق"}
          </p>
        </div>

        {/* Phone Step */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="relative" dir="ltr">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                +966
              </span>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="5XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                className="pl-14 text-left"
                maxLength={10}
                autoFocus
              />
            </div>

            <Button
              onClick={sendOtp}
              disabled={loading || phone.replace(/\D/g, "").length < 9}
              className="w-full gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  إرسال رمز التحقق
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              تسجيل بحساب Google
            </Button>
          </div>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <div className="space-y-6">
            <div className="flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                autoFocus
              >
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

            <p className="text-center text-xs text-muted-foreground">
              تم الإرسال إلى <span dir="ltr" className="font-mono">{fullPhone}</span>
            </p>

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
                className="gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                تغيير الرقم
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={sendOtp}
                disabled={countdown > 0 || loading}
                className="gap-1"
              >
                {countdown > 0 ? `إعادة الإرسال (${countdown})` : "إعادة الإرسال"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
