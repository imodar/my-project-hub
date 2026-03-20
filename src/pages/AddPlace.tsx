import { useState } from "react";
import { MapPin, Link2, Phone, DollarSign, Baby, Tag, StickyNote } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";

type PlaceCategory = "مطاعم" | "كافيهات" | "ترفيه" | "أخرى";
type PriceRange = "$" | "$$" | "$$$" | "$$$$";
type KidFriendly = "yes" | "partial" | "no";

const CATEGORIES: { value: PlaceCategory; label: string; emoji: string }[] = [
  { value: "مطاعم", label: "مطاعم", emoji: "🍕" },
  { value: "كافيهات", label: "كافيهات", emoji: "☕" },
  { value: "ترفيه", label: "ترفيه", emoji: "🎡" },
  { value: "أخرى", label: "أخرى", emoji: "📍" },
];

const PRICE_OPTIONS: { value: PriceRange; label: string }[] = [
  { value: "$", label: "$ رخيص" },
  { value: "$$", label: "$$ متوسط" },
  { value: "$$$", label: "$$$ غالي" },
  { value: "$$$$", label: "$$$$ فاخر" },
];

const KID_OPTIONS: { value: KidFriendly; label: string; emoji: string }[] = [
  { value: "yes", label: "مناسب للأطفال", emoji: "👶" },
  { value: "partial", label: "جزئياً", emoji: "⚠️" },
  { value: "no", label: "غير مناسب", emoji: "🚫" },
];

const AddPlace = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = !!id;
  const listId = location.state?.listId;

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("مطاعم");
  const [address, setAddress] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [phone, setPhone] = useState("");
  const [priceRange, setPriceRange] = useState<PriceRange>("$$");
  const [kidFriendly, setKidFriendly] = useState<KidFriendly>("yes");
  const [mustVisit, setMustVisit] = useState(false);
  const [note, setNote] = useState("");

  // Simulated map state
  const [mapLat] = useState(24.7136);
  const [mapLng] = useState(46.6753);

  const handleSave = () => {
    if (!name.trim()) return;
    haptic.medium();

    // In a real app, this would save to state/DB
    // For now, navigate back
    navigate("/places", {
      state: {
        newPlace: {
          id: crypto.randomUUID(),
          name: name.trim(),
          category,
          location: address ? { lat: mapLat, lng: mapLng, address } : undefined,
          socialLink: socialLink || undefined,
          phone: phone || undefined,
          priceRange,
          rating: undefined,
          kidFriendly,
          addedBy: "أنت",
          visited: false,
          mustVisit,
          note: note || undefined,
        },
        listId,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-28" dir="rtl">
      <PageHeader title={isEdit ? "تعديل المكان" : "إضافة مكان جديد"} />

      <div className="px-4 py-4 space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tag size={16} className="text-primary" />
            اسم المكان *
          </label>
          <Input
            placeholder="مثال: مطعم الشرفة"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">الفئة</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  category === cat.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map / Location */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            الموقع
          </label>
          {/* Simulated map */}
          <div className="w-full h-44 rounded-2xl bg-muted border border-border overflow-hidden relative">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-900/20 dark:to-blue-900/20">
              <div className="text-center">
                <MapPin size={32} className="mx-auto text-destructive mb-1" />
                <p className="text-[11px] text-muted-foreground">اسحب الدبوس لتحديد الموقع</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {mapLat.toFixed(4)}, {mapLng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
          <Input
            placeholder="العنوان (مثال: حي الملقا، الرياض)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {/* Social Link */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            رابط سوشال ميديا
          </label>
          <Input
            placeholder="رابط انستقرام أو تيك توك أو قوقل ماب"
            value={socialLink}
            onChange={(e) => setSocialLink(e.target.value)}
            className="rounded-xl"
            dir="ltr"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Phone size={16} className="text-primary" />
            رقم الهاتف (اختياري)
          </label>
          <Input
            placeholder="05xxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl"
            dir="ltr"
            type="tel"
          />
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign size={16} className="text-primary" />
            الفئة السعرية
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PRICE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPriceRange(opt.value)}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                  priceRange === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kid Friendly */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Baby size={16} className="text-primary" />
            مناسب للأطفال؟
          </label>
          <div className="grid grid-cols-3 gap-2">
            {KID_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setKidFriendly(opt.value)}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  kidFriendly === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Star size={16} className="text-primary" />
            التقييم
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s === rating ? 0 : s)}
                className="p-1"
              >
                <Star
                  size={28}
                  className={`transition-colors ${
                    s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="text-xs text-muted-foreground mr-2">{rating}/5</span>
            )}
          </div>
        </div>

        {/* Must Visit */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
          <div>
            <p className="text-sm font-medium text-foreground">🔴 لازم نروح!</p>
            <p className="text-[11px] text-muted-foreground">تمييز هذا المكان كأولوية</p>
          </div>
          <Switch checked={mustVisit} onCheckedChange={setMustVisit} />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <StickyNote size={16} className="text-primary" />
            ملاحظة
          </label>
          <Textarea
            placeholder="مثال: شفته عند فلان بالانستقرام وقال رهيب..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-xl min-h-[80px]"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="fixed bottom-24 left-4 right-4 max-w-2xl mx-auto z-30">
        <Button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full rounded-2xl shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-sm font-bold gap-2"
        >
          <MapPin size={18} />
          حفظ المكان
        </Button>
      </div>
    </div>
  );
};

export default AddPlace;
