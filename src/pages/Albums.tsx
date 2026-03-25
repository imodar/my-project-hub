import { useState, useRef, useMemo } from "react";
import FAB from "@/components/FAB";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { CardPageSkeleton } from "@/components/PageSkeletons";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Image, Camera, ChevronLeft, X, Plane, Calendar,
  Heart, Trash2, FolderPlus, ImagePlus, AlertTriangle, ImageOff
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useAlbums } from "@/hooks/useAlbums";
import { useTrips } from "@/hooks/useTrips";

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

// Check if an album's linked trip is personal (non-shared)
function isPersonalTripAlbum(album: Album, trips: { id: string; type: string }[]): boolean {
  if (!album.linkedTripId) return false;
  const trip = trips.find((t) => t.id === album.linkedTripId);
  return trip?.type === "personal";
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
  const { featureAccess } = useUserRole();
  const { albums: dbAlbums, isLoading, createAlbum, deleteAlbum, addPhoto, deletePhoto } = useAlbums();
  const { trips: dbTrips } = useTrips();

  // Map DB data to UI format
  const albums: Album[] = useMemo(() => {
    return dbAlbums.map((a: any) => ({
      id: a.id,
      name: a.name,
      coverColor: a.cover_color || COVER_PALETTES[0],
      photos: (a.album_photos || []).map((p: any) => ({
        id: p.id,
        url: p.url,
        date: p.date || p.created_at?.split("T")[0] || "",
        caption: p.caption,
      })),
      createdAt: a.created_at?.split("T")[0] || "",
      linkedTripId: a.linked_trip_id,
      linkedTripName: dbTrips.find((t: any) => t.id === a.linked_trip_id)?.name,
    }));
  }, [dbAlbums, dbTrips]);

  const trips = useMemo(() => {
    return dbTrips.map((t: any) => ({ id: t.id, name: t.name, type: "family" }));
  }, [dbTrips]);

  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Delete confirmation states
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<string | null>(null);

  // Create album form
  const [newName, setNewName] = useState("");
  const [linkToTrip, setLinkToTrip] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedCover, setSelectedCover] = useState(0);

  const handleCreateAlbum = () => {
    if (!newName.trim()) {
      toast.error("أدخل اسم الألبوم");
      return;
    }
    createAlbum.mutate({
      name: newName.trim(),
      cover_color: COVER_PALETTES[selectedCover],
      linked_trip_id: linkToTrip && selectedTripId ? selectedTripId : undefined,
    });
    setShowCreate(false);
    setNewName("");
    setLinkToTrip(false);
    setSelectedTripId("");
    setSelectedCover(0);
    toast.success("تم إنشاء الألبوم");
  };

  const handleDeleteAlbum = (albumId: string) => {
    deleteAlbum.mutate(albumId);
    setSelectedAlbum(null);
    toast.success("تم حذف الألبوم");
  };

  const handleAddPhoto = () => {
    if (!selectedAlbum) return;
    // For now add a placeholder - in production this would open file picker
    addPhoto.mutate({
      album_id: selectedAlbum.id,
      url: "",
      caption: "صورة جديدة",
      date: new Date().toISOString().split("T")[0],
    });
    // Update local selected album view
    const newPhoto: Photo = {
      id: Date.now().toString(),
      url: "",
      date: new Date().toISOString().split("T")[0],
      caption: "صورة جديدة",
    };
    setSelectedAlbum(prev => prev ? { ...prev, photos: [newPhoto, ...prev.photos] } : null);
    toast.success("تمت إضافة الصورة");
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!selectedAlbum) return;
    deletePhoto.mutate(photoId);
    setSelectedAlbum(prev => prev ? { ...prev, photos: prev.photos.filter(p => p.id !== photoId) } : null);
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
            onClick={() => setConfirmDeletePhoto(selectedPhoto.id)}
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
              onClick: () => setConfirmDeleteAlbum(selectedAlbum.id),
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

        <FAB icon={<ImagePlus size={22} />} onClick={handleAddPhoto} />
      </div>
    );
  }

  // Main albums grid
  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
        <PageHeader title="الألبومات" subtitle="صور العائلة وذكرياتها" onBack={() => navigate(-1)} />

      {isLoading ? (
        <CardPageSkeleton />
      ) : (
        <PullToRefresh onRefresh={async () => {
          await new Promise((r) => setTimeout(r, 600));
          toast.success("تم تحديث الألبومات");
        }}>

        <div className="px-5 mt-6">
          {/* Albums grid — masonry-like, filtered for staff/personal trip albums */}
          {(() => {
            let visibleAlbums = albums.filter((a) => !isPersonalTripAlbum(a, trips));
            // Staff only see personal (non-linked) albums
            if (featureAccess.isStaff) {
              visibleAlbums = visibleAlbums.filter((a) => !a.linkedTripId);
            }
            return visibleAlbums.length === 0 ? (
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
              {visibleAlbums.map((album, i) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className={`group relative overflow-hidden rounded-2xl text-start transition-transform active:scale-[0.97] ${
                    i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"
                  }`}
                  style={{ background: album.coverColor }}
                >
                  {/* Photo preview or empty state */}
                  {album.photos.length > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Stacked photos effect */}
                      {album.photos.slice(0, Math.min(3, album.photos.length)).map((p, idx, arr) => {
                        const hue = (p.id.charCodeAt(p.id.length - 1) * 47) % 360;
                        const total = arr.length;
                        const rotation = (idx - Math.floor(total / 2)) * 8;
                        const offsetY = Math.abs(idx - Math.floor(total / 2)) * 4;
                        return (
                          <div
                            key={p.id}
                            className="absolute rounded-lg border-2 border-white/20 shadow-lg overflow-hidden"
                            style={{
                              width: i === 0 ? "35%" : "55%",
                              aspectRatio: "3/4",
                              transform: `rotate(${rotation}deg) translateY(${-offsetY}px)`,
                              zIndex: idx,
                              background: p.url
                                ? `url(${p.url}) center/cover`
                                : `linear-gradient(135deg, hsl(${hue} 45% 68%), hsl(${(hue + 35) % 360} 50% 58%))`,
                            }}
                          >
                            {!p.url && (
                              <div className="w-full h-full flex items-center justify-center">
                                <Camera size={16} className="text-white/30" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageOff size={32} className="text-white/25" />
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
          );
          })()}
        </div>
      </PullToRefresh>
      )}

      <FAB icon={<FolderPlus size={22} />} onClick={() => setShowCreate(true)} />

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

      {/* Confirm Delete Album */}
      <Drawer open={!!confirmDeleteAlbum} onOpenChange={(v) => { if (!v) setConfirmDeleteAlbum(null); }}>
        <DrawerContent>
          <div className="px-5 pb-8 pt-4 text-center space-y-4" dir="rtl">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            <h3 className="text-lg font-extrabold text-foreground">حذف الألبوم</h3>
            <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الألبوم؟ سيتم حذف جميع الصور بداخله.</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold"
                onClick={() => setConfirmDeleteAlbum(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-xl font-bold"
                onClick={() => {
                  if (confirmDeleteAlbum) handleDeleteAlbum(confirmDeleteAlbum);
                  setConfirmDeleteAlbum(null);
                }}
              >
                حذف
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirm Delete Photo */}
      <Drawer open={!!confirmDeletePhoto} onOpenChange={(v) => { if (!v) setConfirmDeletePhoto(null); }}>
        <DrawerContent>
          <div className="px-5 pb-8 pt-4 text-center space-y-4" dir="rtl">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            <h3 className="text-lg font-extrabold text-foreground">حذف الصورة</h3>
            <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذه الصورة؟</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold"
                onClick={() => setConfirmDeletePhoto(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-xl font-bold"
                onClick={() => {
                  if (confirmDeletePhoto) handleDeletePhoto(confirmDeletePhoto);
                  setConfirmDeletePhoto(null);
                }}
              >
                حذف
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Albums;
