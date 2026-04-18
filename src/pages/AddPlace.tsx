import { useState, useEffect, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Link2, Phone, DollarSign, Baby, Tag, StickyNote, Maximize2, Check, Crosshair } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// Fix default marker icons (same as FamilyMap)
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]; // Riyadh

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

  const [mapLat, setMapLat] = useState(DEFAULT_CENTER[0]);
  const [mapLng, setMapLng] = useState(DEFAULT_CENTER[1]);
  const [expanded, setExpanded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Try to use device geolocation on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer Capacitor Geolocation if available
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          const pos = await Geolocation.getCurrentPosition({ timeout: 8000, enableHighAccuracy: false });
          if (!cancelled && pos?.coords) {
            setMapLat(pos.coords.latitude);
            setMapLng(pos.coords.longitude);
            return;
          }
        } catch {
          // fall through to web geolocation
        }
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              if (cancelled) return;
              setMapLat(p.coords.latitude);
              setMapLng(p.coords.longitude);
            },
            () => {},
            { timeout: 8000, maximumAge: 60_000 }
          );
        }
      } catch {
        // silent — keep default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize Leaflet map (re-init when expanded toggles so size is correct)
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    // Tear down existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }

    const map = L.map(el, {
      center: [mapLat, mapLng],
      zoom: 14,
      zoomControl: expanded,
      attributionControl: false,
      scrollWheelZoom: expanded,
      touchZoom: true,
      doubleClickZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    const marker = L.marker([mapLat, mapLng], { draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      setMapLat(ll.lat);
      setMapLng(ll.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setMapLat(e.latlng.lat);
      setMapLng(e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Ensure correct sizing after layout
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Keep marker in sync if mapLat/mapLng changed externally (geolocation arrived)
  useEffect(() => {
    const m = markerRef.current;
    const map = mapRef.current;
    if (!m || !map) return;
    const ll = m.getLatLng();
    if (Math.abs(ll.lat - mapLat) > 1e-6 || Math.abs(ll.lng - mapLng) > 1e-6) {
      m.setLatLng([mapLat, mapLng]);
      map.setView([mapLat, mapLng], map.getZoom());
    }
  }, [mapLat, mapLng]);

  const recenterToMe = useCallback(async () => {
    haptic.light();
    try {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        const pos = await Geolocation.getCurrentPosition({ timeout: 8000, enableHighAccuracy: true });
        if (pos?.coords) {
          setMapLat(pos.coords.latitude);
          setMapLng(pos.coords.longitude);
          return;
        }
      } catch {
        // fall through
      }
      navigator.geolocation?.getCurrentPosition(
        (p) => { setMapLat(p.coords.latitude); setMapLng(p.coords.longitude); },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } catch {
      // silent
    }
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    haptic.medium();
    navigate("/places", {
      state: {
        newPlace: {
          id: crypto.randomUUID(),
          name: name.trim(),
          category,
          location: { lat: mapLat, lng: mapLng, address: address || undefined },
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
    <div className="min-h-screen bg-background pb-28" dir="rtl">
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
            <span className="ms-auto text-[10px] text-muted-foreground font-normal">
              {mapLat.toFixed(4)}, {mapLng.toFixed(4)}
            </span>
          </label>

          {/* Inline expandable map wrapper */}
          <div
            className={cn(
              "rounded-2xl border border-border overflow-hidden relative bg-muted",
              expanded
                ? "fixed inset-0 z-50 rounded-none border-0"
                : "w-full h-56"
            )}
          >
            <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: expanded ? "100vh" : "224px" }} />

            {/* Top-right controls */}
            <div className={cn("absolute z-[1000] flex flex-col gap-2", expanded ? "top-4 end-4" : "top-2 end-2")}>
              <button
                type="button"
                onClick={() => { haptic.light(); setExpanded((v) => !v); }}
                aria-label={expanded ? "تصغير الخريطة" : "توسيع الخريطة"}
                className="w-10 h-10 rounded-full bg-card shadow-lg border border-border flex items-center justify-center text-foreground"
              >
                {expanded ? <Check size={18} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={recenterToMe}
                aria-label="موقعي الحالي"
                className="w-10 h-10 rounded-full bg-card shadow-lg border border-border flex items-center justify-center text-primary"
              >
                <Crosshair size={16} />
              </button>
            </div>

            {/* Hint when collapsed */}
            {!expanded && (
              <div className="absolute bottom-2 start-2 z-[1000] bg-background/85 backdrop-blur px-2 py-1 rounded-md text-[10px] text-muted-foreground border border-border">
                اسحب الدبوس أو اضغط على الخريطة
              </div>
            )}

            {/* Confirm button when expanded */}
            {expanded && (
              <div className="absolute bottom-6 inset-x-6 z-[1000]">
                <Button
                  onClick={() => { haptic.medium(); setExpanded(false); }}
                  className="w-full rounded-2xl shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-sm font-bold gap-2"
                >
                  <Check size={18} />
                  تأكيد هذا الموقع
                </Button>
              </div>
            )}
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
      <div className="px-4 pb-8 pt-2">
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
