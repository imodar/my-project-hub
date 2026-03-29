import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { appToast } from "@/lib/toast";
import { Camera, User, Loader2, Mail } from "lucide-react";
import { motion } from "framer-motion";

const isGoogleEmail = (email: string): boolean => {
  const googleDomains = ["gmail.com", "googlemail.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return googleDomains.includes(domain);
};

const CompleteProfile = () => {
  const { session, user, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [gmailError, setGmailError] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, session, navigate]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      appToast.error("حجم الصورة يجب أن يكون أقل من 5 ميجا");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGmailChange = (value: string) => {
    setGmail(value);
    if (value && !isGoogleEmail(value)) {
      setGmailError("يُقبل فقط بريد Gmail (@gmail.com)");
    } else {
      setGmailError("");
    }
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    setNameError("");

    if (gmail && !isGoogleEmail(gmail)) {
      setGmailError("يُقبل فقط بريد Gmail (@gmail.com)");
      return;
    }

    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl: string | null = null;

      // Upload avatar if selected
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Update profile
      const updatePayload: Record<string, string> = { name: trimmed };
      if (avatarUrl) updatePayload.avatar_url = avatarUrl;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (profileErr) {
        appToast.error("حدث خطأ أثناء الحفظ");
        setSaving(false);
        return;
      }

      // Link Gmail if provided
      if (gmail && isGoogleEmail(gmail)) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: gmail });
        if (emailErr) {
          appToast.error("هذا البريد مستخدم بحساب آخر");
          setGmail("");
          setSaving(false);
          return;
        }
      }

      // Cache and flag
      localStorage.setItem(`profile_name_${user.id}`, trimmed);
      localStorage.setItem("profile_complete", "true");
      await refreshProfile();
      navigate("/", { replace: true });
    } catch {
      appToast.error("حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary via-primary/90 to-primary/70" dir="rtl">
      {/* Top branding */}
      <div className="h-[28vh] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary-foreground/20">
            <User size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-1">أكمل ملفك الشخصي</h1>
          <p className="text-primary-foreground/70 text-sm">أضف اسمك وصورتك للبدء</p>
        </motion.div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 rounded-t-[2rem] px-6 pt-8 pb-10 flex flex-col gap-6 bg-background"
      >
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-[3px] border-primary/30"
              style={{ background: avatar ? "transparent" : "hsl(var(--primary) / 0.15)" }}
            >
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-primary" />
              )}
            </div>
            <label className="absolute bottom-0 left-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer bg-primary border-2 border-background">
              <Camera size={14} className="text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <p className="text-muted-foreground text-xs mt-2">اختياري</p>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-semibold text-foreground block mb-2">الاسم *</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim().length >= 2) setNameError("");
            }}
            placeholder="أدخل اسمك"
            className="w-full px-4 py-3 rounded-xl text-right text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {nameError && <p className="text-destructive text-xs mt-1">{nameError}</p>}
        </div>

        {/* Gmail */}
        <div>
          <label className="text-sm font-semibold text-foreground block mb-2">
            <Mail size={14} className="inline ml-1" />
            بريد Gmail
          </label>
          <input
            value={gmail}
            onChange={(e) => handleGmailChange(e.target.value)}
            placeholder="example@gmail.com"
            type="email"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl text-left text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {gmailError ? (
            <p className="text-destructive text-xs mt-1">{gmailError}</p>
          ) : (
            <p className="text-muted-foreground text-xs mt-1">
              أضف بريد Gmail لتتمكن من الدخول لاحقاً بواسطة Google
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || name.trim().length < 2}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-primary-foreground bg-primary disabled:opacity-50 transition-opacity active:opacity-80"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin mx-auto" />
          ) : (
            "متابعة"
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default CompleteProfile;
