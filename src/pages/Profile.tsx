import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Camera, Mail, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";

const isGoogleEmail = (email: string): boolean => {
  const googleDomains = ["gmail.com", "googlemail.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return googleDomains.includes(domain);
};

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gmail, setGmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [gmailError, setGmailError] = useState("");

  // Load profile via Edge Function
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("auth-management", {
      body: { action: "get-profile" },
    }).then(({ data }) => {
      if (data?.data) {
        setName(data.data.name || "");
        setAvatar(data.data.avatar_url || null);
      }
    });
    // Load current email
    setGmail(user.email || "");
  }, [user]);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setAvatar(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Upload avatar if changed
    let avatarUrl: string | undefined;
    if (avatarFile) {
      const result = await uploadImage("avatars", avatarFile, user.id);
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
        setSaving(false);
        return;
      }
      avatarUrl = result.url;
    }

    const { data: result, error } = await supabase.functions.invoke("auth-management", {
      body: {
        action: "update-profile",
        name,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      },
    });

    setSaving(false);
    if (error || result?.error) {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    } else {
      setEditing(false);
      setAvatarFile(null);
      // Update localStorage cache
      localStorage.setItem(`profile_name_${user.id}`, name);
      if (avatarUrl) setAvatar(avatarUrl);
      toast({ title: "تم حفظ التغييرات" });
    }
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col" style={{
      background: "linear-gradient(180deg, hsl(40, 20%, 97%) 0%, hsl(40, 20%, 95%) 100%)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div />
        <h1 className="text-lg font-bold text-foreground">ملفي الشخصي</h1>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground" style={{ background: "hsla(0,0%,0%,0.05)" }}>
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 px-4 pb-8">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden" style={{
              background: avatar ? "transparent" : "hsl(var(--primary) / 0.15)",
              border: "3px solid hsl(var(--primary) / 0.3)",
            }}>
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{name.charAt(0) || "?"}</span>
              )}
            </div>
            <label className="absolute bottom-0 left-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{
              background: "hsl(var(--primary))",
              border: "2px solid hsl(var(--background))",
            }}>
              <Camera size={14} className="text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <p className="text-muted-foreground text-xs mt-3">اضغط على الكاميرا لتغيير الصورة</p>
        </div>

        {/* Name field */}
        <div className="rounded-2xl p-4 mb-4" style={{
          background: "hsla(0,0%,100%,0.9)",
          boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
        }}>
          <label className="text-xs font-semibold text-muted-foreground block mb-2">الاسم</label>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-right text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "hsl(var(--primary))" }}
              >
                {saving ? "جاري..." : "حفظ"}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors active:bg-muted/50">
              <span className="text-sm font-semibold text-foreground">{name || "أضف اسمك"}</span>
              <span className="text-xs text-primary">تعديل</span>
            </button>
          )}
        </div>

        {/* Phone number (read-only) */}
        <div className="rounded-2xl p-4 mb-4" style={{
          background: "hsla(0,0%,100%,0.9)",
          boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
        }}>
          <label className="text-xs font-semibold text-muted-foreground block mb-2">
            <Phone size={12} className="inline ml-1" />
            رقم الجوال
          </label>
          <div className="px-3 py-2 rounded-xl">
            <span className="text-sm font-semibold text-foreground" dir="ltr">{user?.phone || "غير محدد"}</span>
          </div>
        </div>

        {/* Email (Gmail) */}
        <div className="rounded-2xl p-4 mb-4" style={{
          background: "hsla(0,0%,100%,0.9)",
          boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
        }}>
          <label className="text-xs font-semibold text-muted-foreground block mb-2">
            <Mail size={12} className="inline ml-1" />
            بريد Gmail
          </label>
          {editingEmail ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={gmail}
                  onChange={(e) => {
                    setGmail(e.target.value);
                    if (e.target.value && !isGoogleEmail(e.target.value)) {
                      setGmailError("يُقبل فقط بريد Gmail (@gmail.com)");
                    } else {
                      setGmailError("");
                    }
                  }}
                  placeholder="example@gmail.com"
                  type="email"
                  dir="ltr"
                  className="flex-1 px-3 py-2 rounded-xl text-left text-sm border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (!gmail) { setEditingEmail(false); return; }
                    if (!isGoogleEmail(gmail)) {
                      setGmailError("يُقبل فقط بريد Gmail (@gmail.com)");
                      return;
                    }
                    setSavingEmail(true);
                    const { error } = await supabase.auth.updateUser({ email: gmail });
                    setSavingEmail(false);
                    if (error) {
                      toast({ title: "هذا البريد مستخدم بحساب آخر", variant: "destructive" });
                      setGmail("");
                    } else {
                      setEditingEmail(false);
                      toast({ title: "تم حفظ البريد الإلكتروني" });
                    }
                  }}
                  disabled={savingEmail}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  {savingEmail ? "جاري..." : "حفظ"}
                </button>
              </div>
              {gmailError && <p className="text-destructive text-xs">{gmailError}</p>}
            </div>
          ) : (
            <button onClick={() => setEditingEmail(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors active:bg-muted/50">
              <span className="text-sm font-semibold text-foreground" dir="ltr">{gmail || "أضف بريد Gmail"}</span>
              <span className="text-xs text-primary">تعديل</span>
            </button>
          )}
        </div>

        {/* Role */}
        <div className="rounded-2xl p-4 mb-4" style={{
          background: "hsla(0,0%,100%,0.9)",
          boxShadow: "0 2px 8px hsla(0,0%,0%,0.05)",
        }}>
          <label className="text-xs font-semibold text-muted-foreground block mb-2">الدور</label>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-foreground">ولي الأمر</span>
            <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
              مشرف
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
