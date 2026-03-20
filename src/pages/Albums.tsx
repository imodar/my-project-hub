import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Image, Camera, ChevronLeft, X, Plane, Calendar,
  Heart, Trash2, FolderPlus, ImagePlus
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

interface Photo {
  id: string;
  url: string;
  date: string;
  caption?: string;
}

interface Album {
  id: string;
  name: string;
  coverColor: string;
  photos: Photo[];
  createdAt: string;
  linkedTripId?: string;
  linkedTripName?: string;
}

// Gorgeous color palettes for album covers
const COVER_PALETTES = [
  "linear-gradient(135deg, hsl(340 65% 47%), hsl(350 80% 62%))",
  "linear-gradient(135deg, hsl(210 78% 42%), hsl(200 85% 58%))",
  "linear-gradient(135deg, hsl(160 50% 38%), hsl(145 55% 52%))",
  "linear-gradient(135deg, hsl(35 85% 48%), hsl(25 90% 58%))",
  "linear-gradient(135deg, hsl(270 55% 48%), hsl(280 60% 62%))",
  "linear-gradient(135deg, hsl(190 65% 40%), hsl(175 70% 50%))",
  "linear-gradient(135deg, hsl(0 0% 30%), hsl(0 0% 50%))",
  "linear-gradient(135deg, hsl(15 75% 45%), hsl(5 80% 55%))",
];

// Sample placeholder photos (using gradient squares as placeholders)
const SAMPLE_PHOTOS: Photo[] = [
  { id: "sp1", url: "", date: "2026-03-15", caption: "لحظة عائلية" },
  { id: "sp2", url: "", date: "2026-03-15", caption: "في الحديقة" },
  { id: "sp3", url: "", date: "2026-03-10", caption: "عشاء عائلي" },
  { id: "sp4", url: "", date: "2026-02-20", caption: "يوم ممطر" },
  { id: "sp5", url: "", date: "2026-02-14", caption: "ذكريات جميلة" },
  { id: "sp6", url: "", date: "2026-01-01", caption: "بداية السنة" },
];

const INITIAL_ALBUMS: Album[] = [
  {
    id: "a1",
    name: "ذكريات عائلية",
    coverColor: COVER_PALETTES[0],
    photos: SAMPLE_PHOTOS.slice(0, 4),
    createdAt: "2026-03-01",
  },
  {
    id: "a2",
    name: "رحلة إسطنبول",
    coverColor: COVER_PALETTES[1],
    photos: SAMPLE_PHOTOS.slice(1, 6),
    createdAt: "2026-04-15",
    linkedTripId: "1",
    linkedTripName: "رحلة إسطنبول",
  },
  {
    id: "a3",
    name: "مناسبات",
    coverColor: COVER_PALETTES[3],
    photos: SAMPLE_PHOTOS.slice(2, 5),
    createdAt: "2026-02-10",
  },
];

// Get saved trips from localStorage
function getSavedTrips(): { id: string; name: string; type: string }[] {
  try {
    const stored = localStorage.getItem("family-trips");
    if (stored) {
      const trips = JSON.parse(stored);
      return trips.map((t: any) => ({ id: t.id, name: t.name, type: t.type }));
    }
  } catch {}
  return [
    { id: "1", name: "رحلة إسطنبول", type: "family" },
    { id: "2", name: "استراحة نهاية الأسبوع", type: "personal" },
  ];
}

// Photo placeholder component
const PhotoThumb = ({ photo, size = "md", onClick }: { photo: Photo; size?: "sm" | "md" | "lg"; onClick?: () => void }) => {
  const sizeClasses = {
    sm: "w-full aspect-square",
    md: "w-full aspect-square",
    lg: "w-full aspect-[4/3]",
  };

  // Generate a unique color from photo id
  const hue = (photo.id.charCodeAt(photo.id.length - 1) * 47) % 360;

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-xl overflow-hidden relative group transition-transform active:scale-[0.97]`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 40% 75%), hsl(${(hue + 40) % 360} 50% 65%))`,
      }}
    >
      {photo.url ? (
        <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Camera size={size === "sm" ? 16 : 24} className="text-white/40" />
        </div>
      )}
      {photo.caption && (
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
          <span className="text-[10px] text-white/90 font-medium">{photo.caption}</span>
        </div>
      )}
    </button>
  );
};

const Albums = () => {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>(INITIAL_ALBUMS);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Create album form
  const [newName, setNewName] = useState("");
  const [linkToTrip, setLinkToTrip] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedCover, setSelectedCover] = useState(0);

  const trips = getSavedTrips();

  const handleCreateAlbum = () => {
    if (!newName.trim()) {
      toast.error("أدخل اسم الألبوم");
      return;
    }

    const linkedTrip = linkToTrip ? trips.find((t) => t.id === selectedTripId) : null;

    const album: Album = {
      id: Date.now().toString(),
      name: newName.trim(),
      coverColor: COVER_PALETTES[selectedCover],
      photos: [],
      createdAt: new Date().toISOString().split("T")[0],
      linkedTripId: linkedTrip?.id,
      linkedTripName: linkedTrip?.name,
    };

    setAlbums((prev) => [album, ...prev]);
    setShowCreate(false);
    setNewName("");
    setLinkToTrip(false);
    setSelectedTripId("");
    setSelectedCover(0);
    toast.success("تم إنشاء الألبوم");
  };

  const handleDeleteAlbum = (albumId: string) => {
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    setSelectedAlbum(null);
    toast.success("تم حذف الألبوم");
  };

  const handleAddPhoto = () => {
    if (!selectedAlbum) return;
    const newPhoto: Photo = {
      id: Date.now().toString(),
      url: "",
      date: new Date().toISOString().split("T")[0],
      caption: "صورة جديدة",
    };
    const updated = { ...selectedAlbum, photos: [newPhoto, ...selectedAlbum.photos] };
    setSelectedAlbum(updated);
    setAlbums((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    toast.success("تمت إضافة الصورة");
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!selectedAlbum) return;
    const updated = {
      ...selectedAlbum,
      photos: selectedAlbum.photos.filter((p) => p.id !== photoId),
    };
    setSelectedAlbum(updated);
    setAlbums((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedPhoto(null);
    toast.success("تم حذف الصورة");
  };

  // Group photos by date
  const groupPhotosByDate = (photos: Photo[]) => {
    const groups: Record<string, Photo[]> = {};
    photos.forEach((p) => {
      const key = p.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  // Photo viewer
  if (selectedPhoto && selectedAlbum) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col" dir="rtl">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setSelectedPhoto(null)} className="text-white/80 active:scale-95">
            <X size={24} />
          </button>
          <span className="text-white/60 text-sm">
            {format(new Date(selectedPhoto.date), "d MMMM yyyy", { locale: ar })}
          </span>
          <button
            onClick={() => handleDeletePhoto(selectedPhoto.id)}
            className="text-red-400 active:scale-95"
          >
            <Trash2 size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          {selectedPhoto.url ? (
            <img src={selectedPhoto.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          ) : (
            <div
              className="w-72 h-72 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${(selectedPhoto.id.charCodeAt(selectedPhoto.id.length - 1) * 47) % 360} 40% 75%), hsl(${((selectedPhoto.id.charCodeAt(selectedPhoto.id.length - 1) * 47 + 40)) % 360} 50% 65%))`,
              }}
            >
              <Camera size={48} className="text-white/30" />
            </div>
          )}
        </div>
        {selectedPhoto.caption && (
          <div className="p-6 text-center">
            <p className="text-white/80 text-sm">{selectedPhoto.caption}</p>
          </div>
        )}
      </div>
    );
  }

  // Album detail view
  if (selectedAlbum) {
    const grouped = groupPhotosByDate(selectedAlbum.photos);
    return (
      <div className="min-h-screen bg-background pb-32" dir="rtl">
        <PageHeader
          title={selectedAlbum.name}
          subtitle={`${selectedAlbum.photos.length} صورة`}
          onBack={() => setSelectedAlbum(null)}
          actions={[
            {
              icon: <Trash2 size={18} className="text-white" />,
              onClick: () => handleDeleteAlbum(selectedAlbum.id),
            },
          ]}
        />

        {selectedAlbum.linkedTripName && (
          <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10">
            <Plane size={14} className="text-primary" />
            <span className="text-xs font-bold text-primary">{selectedAlbum.linkedTripName}</span>
          </div>
        )}

        {selectedAlbum.photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
              style={{ background: "hsl(var(--muted))" }}
            >
              <Image size={32} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm font-bold mb-1">لا توجد صور</p>
            <p className="text-muted-foreground/60 text-xs text-center">
              أضف صوراً لهذا الألبوم
            </p>
          </div>
        ) : (
          <div className="px-4 mt-5 space-y-6">
            {grouped.map(([date, photos]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={12} className="text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground">
                    {format(new Date(date), "EEEE، d MMMM yyyy", { locale: ar })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((photo) => (
                    <PhotoThumb
                      key={photo.id}
                      photo={photo}
                      size="md"
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={handleAddPhoto}
          className="fixed bottom-28 left-5 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
          }}
        >
          <ImagePlus size={22} className="text-primary-foreground" />
        </button>
      </div>
    );
  }

  // Main albums grid
  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      <PullToRefresh onRefresh={async () => {}}>
        <PageHeader title="الألبومات" subtitle="صور العائلة وذكرياتها" onBack={() => navigate(-1)} />

        <div className="px-5 mt-6">
          {/* Albums grid — masonry-like */}
          {albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: "hsl(var(--muted))" }}
              >
                <Image size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm font-bold mb-1">لا توجد ألبومات</p>
              <p className="text-muted-foreground/60 text-xs text-center">
                أنشئ ألبوماً جديداً لحفظ ذكريات عائلتك
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {albums.map((album, i) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className={`group relative overflow-hidden rounded-2xl text-start transition-transform active:scale-[0.97] ${
                    i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"
                  }`}
                  style={{ background: album.coverColor }}
                >
                  {/* Photo grid preview */}
                  {album.photos.length > 0 && (
                    <div className="absolute inset-0 grid grid-cols-2 gap-[1px] opacity-30">
                      {album.photos.slice(0, 4).map((p) => {
                        const hue = (p.id.charCodeAt(p.id.length - 1) * 47) % 360;
                        return (
                          <div
                            key={p.id}
                            className="w-full h-full"
                            style={{
                              background: p.url
                                ? `url(${p.url}) center/cover`
                                : `linear-gradient(135deg, hsl(${hue} 35% 70%), hsl(${(hue + 30) % 360} 40% 60%))`,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Content */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-4">
                    {album.linkedTripName && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Plane size={10} className="text-white/70" />
                        <span className="text-[10px] text-white/70 font-medium">
                          {album.linkedTripName}
                        </span>
                      </div>
                    )}
                    <h3 className="text-white font-extrabold text-sm leading-tight">
                      {album.name}
                    </h3>
                    <span className="text-white/60 text-[11px] font-medium">
                      {album.photos.length} صورة
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-28 left-5 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
        }}
      >
        <FolderPlus size={22} className="text-primary-foreground" />
      </button>

      {/* Create Album Drawer */}
      <Drawer open={showCreate} onOpenChange={setShowCreate}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>ألبوم جديد</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-8 space-y-5" dir="rtl">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-2 block">اسم الألبوم</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: ذكريات الصيف"
                className="text-right"
              />
            </div>

            {/* Cover color */}
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-2 block">لون الغلاف</label>
              <div className="flex gap-2 flex-wrap">
                {COVER_PALETTES.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedCover(i)}
                    className={`w-10 h-10 rounded-xl transition-all active:scale-90 ${
                      selectedCover === i ? "ring-2 ring-primary ring-offset-2 scale-110" : ""
                    }`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            {/* Link to trip */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="link-trip"
                  checked={linkToTrip}
                  onCheckedChange={(v) => {
                    setLinkToTrip(!!v);
                    if (!v) setSelectedTripId("");
                  }}
                />
                <label htmlFor="link-trip" className="text-sm font-bold cursor-pointer">
                  ربط الألبوم برحلة مسجلة
                </label>
              </div>

              {linkToTrip && (
                <div className="space-y-2 mr-7">
                  {trips.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد رحلات مسجلة</p>
                  ) : (
                    <>
                      {/* Personal trips */}
                      {trips.filter((t) => t.type === "personal").length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">
                            رحلات شخصية
                          </span>
                          <div className="space-y-1.5">
                            {trips
                              .filter((t) => t.type === "personal")
                              .map((trip) => (
                                <button
                                  key={trip.id}
                                  onClick={() => setSelectedTripId(trip.id)}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
                                    selectedTripId === trip.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  <Plane size={14} />
                                  {trip.name}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Family trips */}
                      {trips.filter((t) => t.type === "family").length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">
                            رحلات عائلية
                          </span>
                          <div className="space-y-1.5">
                            {trips
                              .filter((t) => t.type === "family")
                              .map((trip) => (
                                <button
                                  key={trip.id}
                                  onClick={() => setSelectedTripId(trip.id)}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
                                    selectedTripId === trip.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  <Plane size={14} />
                                  {trip.name}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleCreateAlbum} className="w-full h-12 rounded-xl font-bold text-base">
              إنشاء الألبوم
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Albums;
