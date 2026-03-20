import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, MapPin, Users, Lock, Share2, Trash2, MoreVertical, Pencil, Check, Star, RotateCcw } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import PageHeader from "@/components/PageHeader";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { haptic } from "@/lib/haptics";

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  description?: string;
  location?: { lat: number; lng: number; address?: string };
  socialLink?: string;
  phone?: string;
  priceRange: PriceRange;
  rating?: number;
  kidFriendly: "yes" | "partial" | "no";
  addedBy: string;
  suggestedBy?: string;
  visited: boolean;
  mustVisit?: boolean;
  note?: string;
}

type PlaceCategory = "مطاعم" | "كافيهات" | "ترفيه" | "أخرى";
type PriceRange = "$" | "$$" | "$$$" | "$$$$";

interface PlaceList {
  id: string;
  name: string;
  type: "family" | "personal" | "shared";
  isDefault?: boolean;
  sharedWith?: string[];
  places: Place[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const CATEGORY_INFO: Record<PlaceCategory, { emoji: string; bg: string; text: string }> = {
  "مطاعم": { emoji: "🍕", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  "كافيهات": { emoji: "☕", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  "ترفيه": { emoji: "🎡", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  "أخرى": { emoji: "📍", bg: "bg-muted", text: "text-muted-foreground" },
};

const CATEGORIES: (PlaceCategory | "الكل")[] = ["الكل", "مطاعم", "كافيهات", "ترفيه", "أخرى"];
const FAMILY_MEMBERS = ["أبو فهد", "أم فهد", "فهد", "نورة", "سارة"];

const PRICE_LABELS: Record<PriceRange, string> = {
  "$": "رخيص",
  "$$": "متوسط",
  "$$$": "غالي",
  "$$$$": "فاخر",
};

const KID_LABELS: Record<string, { label: string; emoji: string }> = {
  yes: { label: "مناسب للأطفال", emoji: "👶" },
  partial: { label: "جزئياً للأطفال", emoji: "⚠️" },
  no: { label: "غير مناسب للأطفال", emoji: "🚫" },
};

const initialLists: PlaceList[] = [
  {
    id: "1",
    name: "قائمة الأماكن",
    type: "family",
    isDefault: true,
    lastUpdatedBy: "أبو فهد",
    lastUpdatedAt: "منذ ساعة",
    places: [
      {
        id: "p1",
        name: "مطعم بيتزا ناعومي",
        category: "مطاعم",
        description: "قالوا البيتزا لا تُقوّت",
        location: { lat: 24.7136, lng: 46.6753, address: "مطعم · حي الملقا" },
        priceRange: "$$",
        rating: 4,
        kidFriendly: "yes",
        addedBy: "أبو فهد",
        suggestedBy: "أبو فهد",
        visited: false,
        mustVisit: true,
        note: "اقترح: أبو فهد · \"قالوا البيتزا لا تقوّت\"",
      },
      {
        id: "p2",
        name: "كافيه ذا روف",
        category: "كافيهات",
        description: "",
        location: { lat: 24.7236, lng: 46.6353, address: "كافيه · العليا" },
        priceRange: "$$$",
        rating: 5,
        kidFriendly: "partial",
        addedBy: "أم فهد",
        suggestedBy: "أم فهد",
        visited: false,
        mustVisit: false,
        note: "اقترحت: أم فهد",
      },
      {
        id: "p3",
        name: "فنتازيا",
        category: "ترفيه",
        description: "",
        location: { lat: 24.7000, lng: 46.7100, address: "ترفيه · حي العارض" },
        priceRange: "$$",
        rating: 5,
        kidFriendly: "yes",
        addedBy: "أم فهد",
        visited: true,
        note: "ممتاز – نرجعله!",
      },
    ],
  },
];

const SWIPE_WIDTH = 140;

const Places = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<PlaceList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(lists[0]?.id || "");
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | "الكل">("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const activeSwipeRef = useRef<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"family" | "personal">("family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredPlaces = activeList?.places.filter((place) => {
    const matchesCat = activeCategory === "الكل" || place.category === activeCategory;
    const matchesSearch = !searchQuery || place.name.includes(searchQuery);
    return matchesCat && matchesSearch;
  }) || [];

  const unvisitedPlaces = filteredPlaces.filter((p) => !p.visited);
  const visitedPlaces = filteredPlaces.filter((p) => p.visited);

  const totalPlaces = activeList?.places.length || 0;

  // Swipe handlers
  const closeSwipe = useCallback((id: string) => {
    setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    activeSwipeRef.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    touchStartXRef.current = e.clientX;
    activeSwipeRef.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (activeSwipeRef.current !== id) return;
    const diff = e.clientX - touchStartXRef.current;
    setSwipeOffset((prev) => ({ ...prev, [id]: diff > 0 ? Math.min(diff, SWIPE_WIDTH) : 0 }));
  };

  const handlePointerUp = (e: React.PointerEvent, id: string) => {
    const offset = swipeOffset[id] || 0;
    setSwipeOffset((prev) => ({ ...prev, [id]: offset > 60 ? SWIPE_WIDTH : 0 }));
    activeSwipeRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const toggleVisited = useCallback((placeId: string) => {
    haptic.light();
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, places: list.places.map((p) => p.id === placeId ? { ...p, visited: !p.visited } : p) }
          : list
      )
    );
  }, [activeListId]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, places: list.places.filter((p) => p.id !== deleteTarget.id) }
          : list
      )
    );
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  }, [activeListId, deleteTarget]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    const newList: PlaceList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      type: newListType === "family" && newListShareMembers.length > 0 ? "shared" : newListType,
      sharedWith: newListType === "family" ? newListShareMembers : undefined,
      lastUpdatedBy: "أنت",
      lastUpdatedAt: "الآن",
      places: [],
    };
    setLists((prev) => [...prev, newList]);
    setActiveListId(newList.id);
    setNewListName("");
    setNewListShareMembers([]);
    setShowAddList(false);
  }, [newListName, newListType, newListShareMembers]);

  const deleteList = useCallback((listId: string) => {
    haptic.medium();
    setLists((prev) => {
      const updated = prev.filter((l) => l.id !== listId);
      if (activeListId === listId && updated.length > 0) {
        setActiveListId(updated[0].id);
      }
      return updated;
    });
  }, [activeListId]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0) return;
    haptic.medium();
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, type: "shared", sharedWith: selectedShareMembers }
          : list
      )
    );
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [activeListId, selectedShareMembers]);

  const getListIcon = (type: PlaceList["type"]) => {
    switch (type) {
      case "family": return <Users size={14} className="text-primary" />;
      case "personal": return <Lock size={14} className="text-accent" />;
      case "shared": return <Share2 size={14} className="text-blue-500" />;
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={12} className={s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"} />
        ))}
      </div>
    );
  };

  const renderPlace = (place: Place) => {
    const catInfo = CATEGORY_INFO[place.category];
    const offset = swipeOffset[place.id] || 0;
    const kidInfo = KID_LABELS[place.kidFriendly];

    return (
      <div key={place.id} className="relative overflow-hidden rounded-2xl select-none">
        {/* Swipe actions */}
        <div
          className="absolute left-0 top-0 bottom-0 flex items-stretch gap-1 rounded-2xl overflow-hidden p-1"
          style={{ width: `${SWIPE_WIDTH}px` }}
        >
          <button
            onClick={() => { setDeleteTarget(place); closeSwipe(place.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 transition-colors rounded-xl"
          >
            <Trash2 size={16} className="text-destructive-foreground" />
            <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
          </button>
          <button
            onClick={() => {
              closeSwipe(place.id);
              navigate(`/places/edit/${place.id}`, { state: { place, listId: activeListId } });
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
            style={{ background: "hsl(220, 60%, 50%)" }}
          >
            <Pencil size={16} className="text-white" />
            <span className="text-[10px] text-white font-semibold">تعديل</span>
          </button>
        </div>

        {/* Card */}
        <div
          className={`relative z-10 bg-card border border-border rounded-2xl p-3 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing`}
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, place.id)}
          onPointerMove={(e) => handlePointerMove(e, place.id)}
          onPointerUp={(e) => handlePointerUp(e, place.id)}
          onPointerCancel={() => closeSwipe(place.id)}
        >
          <div className="flex items-start gap-3">
            {/* Category icon */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${catInfo.bg}`}>
              {catInfo.emoji}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className={`font-bold text-sm text-foreground truncate ${place.visited ? "line-through opacity-60" : ""}`}>
                  {place.name}
                </h4>
                {place.mustVisit && (
                  <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    🔴 لازم نروح
                  </span>
                )}
                {place.visited && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    ✅ زرناه
                  </span>
                )}
              </div>

              {/* Location */}
              {place.location?.address && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  📍 {place.location.address}
                </p>
              )}

              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap">
                {kidInfo && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    place.kidFriendly === "yes" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : place.kidFriendly === "partial" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  }`}>
                    {kidInfo.emoji} {kidInfo.label}
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                  {place.priceRange} {PRICE_LABELS[place.priceRange]}
                </span>
              </div>

              {/* Note */}
              {place.note && (
                <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                  {place.note}
                </p>
              )}
            </div>

            {/* Right side: star + visit toggle */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {place.mustVisit && <Star size={16} className="fill-yellow-400 text-yellow-400" />}
              <button
                onClick={() => toggleVisited(place.id)}
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  place.visited
                    ? "bg-primary"
                    : "border-2 border-border hover:border-primary"
                }`}
              >
                {place.visited && <Check size={14} className="text-primary-foreground" />}
              </button>
            </div>
          </div>

          {/* Rating */}
          {place.rating && (
            <div className="flex items-center gap-1 mt-2">
              {renderStars(place.rating)}
              {place.note && place.visited && (
                <span className="text-[10px] text-muted-foreground mr-1">
                  {place.note}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  // Random suggestion
  const suggestRandom = () => {
    const unvisited = activeList?.places.filter((p) => !p.visited) || [];
    if (unvisited.length === 0) return;
    const random = unvisited[Math.floor(Math.random() * unvisited.length)];
    haptic.medium();
    alert(`💡 اقتراح اليوم: ${random.name}`);
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-28" dir="rtl">
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Header */}
        <PageHeader
          title="قائمة الأماكن"
          actions={[
            {
              icon: <Plus size={20} className="text-white" />,
              onClick: () => setShowAddList(true),
            },
            {
              icon: <Search size={18} className="text-white" />,
              onClick: () => setSearchQuery(searchQuery ? "" : " "),
            },
          ]}
        >
          {/* Lists tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-2 scrollbar-hide">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => {
                  haptic.light();
                  setActiveListId(list.id);
                  setActiveCategory("الكل");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeListId === list.id
                    ? "bg-white text-foreground shadow-md"
                    : "bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                {getListIcon(list.type)}
                {list.name}
                {list.type === "personal" && <Lock size={10} />}
              </button>
            ))}
          </div>
        </PageHeader>

        {/* Suggest banner */}
        <div className="px-4 pt-3">
          <button
            onClick={suggestRandom}
            className="w-full flex items-center justify-between p-3 rounded-2xl border border-border"
            style={{ background: "linear-gradient(135deg, hsl(145, 40%, 92%), hsl(200, 50%, 92%))" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎲</span>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">فين نروح اليوم؟</p>
                <p className="text-[11px] text-muted-foreground">{totalPlaces} مكان في قائمتك</p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground">اقترح!</span>
          </button>
        </div>

        {/* Stats bar */}
        {activeList && !activeList.isDefault && (
          <div className="px-4 py-2 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-lg hover:bg-muted">
                  <MoreVertical size={16} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {activeList.type !== "family" && (
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share2 size={14} className="ml-2" />
                    مشاركة القائمة
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => deleteList(activeList.id)}>
                  <Trash2 size={14} className="ml-2" />
                  حذف القائمة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Search */}
        {searchQuery !== "" && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث عن مكان..."
                value={searchQuery.trim()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 bg-card border-border rounded-xl text-sm"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Category filters */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const isAll = cat === "الكل";
            const catInfo = !isAll ? CATEGORY_INFO[cat] : null;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  haptic.light();
                  setActiveCategory(cat);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border text-foreground hover:bg-muted"
                }`}
              >
                {isAll ? "🗺️" : catInfo?.emoji}
                {cat}
              </button>
            );
          })}
        </div>

        {/* Places list */}
        <div className="px-4 space-y-2">
          {unvisitedPlaces.map((place) => renderPlace(place))}

          {visitedPlaces.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2 font-medium">✅ زرناها</p>
              {visitedPlaces.map((place) => renderPlace(place))}
            </div>
          )}

          {filteredPlaces.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد أماكن</p>
            </div>
          )}
        </div>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المكان</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف "{deleteTarget?.name}"؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2">
              <AlertDialogAction onClick={confirmDelete} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
                حذف
              </AlertDialogAction>
              <AlertDialogCancel className="flex-1 rounded-xl">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add List Drawer */}
        <Drawer open={showAddList} onOpenChange={setShowAddList}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>إنشاء قائمة جديدة</DrawerTitle>
              <DrawerDescription>أنشئ قائمة أماكن جديدة</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-3">
              <Input placeholder="اسم القائمة" value={newListName} onChange={(e) => setNewListName(e.target.value)} className="rounded-xl" />
              <div>
                <p className="text-xs text-muted-foreground mb-2">نوع القائمة</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewListType("family")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                      newListType === "family" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Users size={16} /> مشتركة
                  </button>
                  <button
                    onClick={() => setNewListType("personal")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                      newListType === "personal" ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Lock size={16} /> خاصة بي
                  </button>
                </div>
              </div>
              {newListType === "family" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">مشاركة مع</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {FAMILY_MEMBERS.map((member) => (
                      <button
                        key={member}
                        onClick={() =>
                          setNewListShareMembers((prev) =>
                            prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
                          )
                        }
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                          newListShareMembers.includes(member) ? "border-primary bg-primary/10" : "border-border bg-card"
                        }`}
                      >
                        <span className="font-medium text-foreground">{member}</span>
                        {newListShareMembers.includes(member) && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button onClick={addList} className="flex-1 rounded-xl">إنشاء</Button>
              <Button variant="outline" onClick={() => setShowAddList(false)} className="flex-1 rounded-xl">إلغاء</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Share Drawer */}
        <Drawer open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>مشاركة القائمة</DrawerTitle>
              <DrawerDescription>اختر أفراد العائلة لمشاركة هذه القائمة معهم</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-2">
              {FAMILY_MEMBERS.map((member) => (
                <button
                  key={member}
                  onClick={() =>
                    setSelectedShareMembers((prev) =>
                      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
                    )
                  }
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                    selectedShareMembers.includes(member) ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="font-medium text-foreground">{member}</span>
                  {selectedShareMembers.includes(member) && <Check size={16} className="text-primary" />}
                </button>
              ))}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button onClick={shareList} className="flex-1 rounded-xl">مشاركة</Button>
              <Button variant="outline" onClick={() => setShowShareDialog(false)} className="flex-1 rounded-xl">إلغاء</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PullToRefresh>

      {/* FAB add button */}
      {createPortal(
        <button
          onClick={() => navigate("/places/add", { state: { listId: activeListId } })}
          className="fixed bottom-28 left-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-transform"
        >
          <Plus size={24} />
        </button>,
        document.body
      )}
    </div>
  );
};

export default Places;
