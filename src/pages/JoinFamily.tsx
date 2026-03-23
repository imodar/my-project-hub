import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Users, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type JoinStatus = "loading" | "joining" | "success" | "error" | "no-code";

const JoinFamily = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<JoinStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!code) {
      setStatus("no-code");
      return;
    }

    // If still loading auth, wait
    if (authLoading) return;

    // Not logged in → store code and redirect to auth
    if (!user) {
      localStorage.setItem("pending_invite_code", code);
      navigate("/auth", { replace: true });
      return;
    }

    // Logged in → attempt join
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    joinFamily(code);
  }, [code, user, authLoading, navigate]);

  const joinFamily = async (inviteCode: string) => {
    setStatus("joining");
    try {
      const { data, error } = await supabase.functions.invoke("family-management", {
        body: { action: "join", invite_code: inviteCode, role: "son" },
      });

      if (error || data?.error) {
        const msg = data?.error || "فشل الانضمام";
        // If already a member, treat as success
        if (msg.includes("عضو بالفعل")) {
          setStatus("success");
          toast({ title: "أنت عضو بالفعل في هذه العائلة" });
          setTimeout(() => navigate("/family", { replace: true }), 1500);
          return;
        }
        setErrorMsg(msg);
        setStatus("error");
      } else {
        setStatus("success");
        toast({ title: "تم الانضمام للعائلة بنجاح! 🎉" });
        // Clear any stored code
        localStorage.removeItem("pending_invite_code");
        setTimeout(() => navigate("/family", { replace: true }), 1500);
      }
    } catch {
      setErrorMsg("حدث خطأ غير متوقع");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" style={{ direction: "rtl" }}>
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Loading */}
        {(status === "loading" || status === "joining") && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
              <Loader2 size={36} className="text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {status === "loading" ? "جاري التحقق..." : "جاري الانضمام للعائلة..."}
            </h1>
            <p className="text-sm text-muted-foreground">يرجى الانتظار</p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 size={36} className="text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-foreground">تم الانضمام بنجاح! 🎉</h1>
            <p className="text-sm text-muted-foreground">جاري توجيهك لصفحة العائلة...</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-destructive/10">
              <XCircle size={36} className="text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">فشل الانضمام</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { attemptedRef.current = false; joinFamily(code!); }} variant="default">
                إعادة المحاولة
              </Button>
              <Button onClick={() => navigate("/", { replace: true })} variant="outline">
                الرئيسية
              </Button>
            </div>
          </div>
        )}

        {/* No code */}
        {status === "no-code" && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
              <Users size={36} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">رابط غير صالح</h1>
            <p className="text-sm text-muted-foreground">لم يتم العثور على كود دعوة في الرابط</p>
            <Button onClick={() => navigate("/", { replace: true })} variant="default">
              الرئيسية
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinFamily;
