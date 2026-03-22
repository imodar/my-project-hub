import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Profile = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("أحمد");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatar(ev.target?.result as string);
      reader.readAsDataURL(file);
      toast({ title: "تم تحديث الصورة الشخصية" });
    }
  };

  const handleSave = () => {
    setEditing(false);
    toast({ title: "تم حفظ التغييرات" });
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
                <span className="text-3xl font-bold text-primary">{name.charAt(0)}</span>
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
              <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "hsl(var(--primary))" }}>
                حفظ
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors active:bg-muted/50">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              <span className="text-xs text-primary">تعديل</span>
            </button>
          )}
        </div>

        {/* Role */}
        <div className="rounded-2xl p-4" style={{
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
