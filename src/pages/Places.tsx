import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, MapPin, Users, Lock, Share2, Trash2, MoreVertical, Pencil, Check, Star, RotateCcw, SlidersHorizontal, Baby, DollarSign } from "lucide-react";
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
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filterRating, setFilterRating] = useState(0);
  const [filterPrice, setFilterPrice] = useState<PriceRange | "الكل">("الكل");
  const [filterKid, setFilterKid] = useState<"yes" | "partial" | "no" | "الكل">("الكل");
  const [filterMustVisit, setFilterMustVisit] = useState(false);
  const [filterVisitStatus, setFilterVisitStatus] = useState<"الكل" | "visited" | "unvisited">("الكل");

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const activeSwipeRef = useRef<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);

  // Visit review bottom sheet
  const [reviewPlace, setReviewPlace] = useState<Place | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewWouldReturn, setReviewWouldReturn] = useState<"yes" | "no" | null>(null);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"family" | "personal">("family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);

  const activeList = lists.find((l) => l.id === activeListId);

  const hasActiveFilters = filterRating > 0 || filterPrice !== "الكل" || filterKid !== "الكل" || filterMustVisit || filterVisitStatus !== "الكل" || activeCategory !== "الكل";

  const filteredPlaces = activeList?.places.filter((place) => {
    const matchesCat = activeCategory === "الكل" || place.category === activeCategory;
    const matchesRating = filterRating === 0 || (place.rating && place.rating >= filterRating);
    const matchesPrice = filterPrice === "الكل" || place.priceRange === filterPrice;
    const matchesKid = filterKid === "الكل" || place.kidFriendly === filterKid;
    const matchesMustVisit = !filterMustVisit || place.mustVisit;
    const matchesVisit = filterVisitStatus === "الكل" || (filterVisitStatus === "visited" ? place.visited : !place.visited);
    return matchesCat && matchesRating && matchesPrice && matchesKid && matchesMustVisit && matchesVisit;
  }) || [];

  const unvisitedPlaces = filteredPlaces.filter((p) => !p.visited);
  const visitedPlaces = filteredPlaces.filter((p) => p.visited);

  const resetFilters = () => {
    setActiveCategory("الكل");
    setFilterRating(0);
    setFilterPrice("الكل");
    setFilterKid("الكل");
    setFilterMustVisit(false);
    setFilterVisitStatus("الكل");
  };

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
    const place = activeList?.places.find((p) => p.id === placeId);
    if (!place) return;
    haptic.light();
    
    if (!place.visited) {
      // Opening review sheet for marking as visited
      setReviewPlace(place);
      setReviewRating(place.rating || 0);
      setReviewWouldReturn(null);
    } else {
      // Unmark as visited
      setLists((prev) =>
        prev.map((list) =>
          list.id === activeListId
            ? { ...list, places: list.places.map((p) => p.id === placeId ? { ...p, visited: false, rating: undefined } : p) }
            : list
        )
      );
    }
  }, [activeListId, activeList]);

  const confirmVisitReview = useCallback(() => {
    if (!reviewPlace) return;
    haptic.medium();
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              places: list.places.map((p) =>
                p.id === reviewPlace.id
                  ? {
                      ...p,
                      visited: true,
                      rating: reviewRating || undefined,
                      note: reviewWouldReturn === "yes" ? (p.note ? p.note + " · نرجعله!" : "نرجعله!") : p.note,
                    }
                  : p
              ),
            }
          : list
      )
    );
    setReviewPlace(null);
    setReviewRating(0);
    setReviewWouldReturn(null);
  }, [activeListId, reviewPlace, reviewRating, reviewWouldReturn]);

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
          className="relative z-10 bg-card rounded-2xl p-4 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing shadow-sm"
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, place.id)}
          onPointerMove={(e) => handlePointerMove(e, place.id)}
          onPointerUp={(e) => handlePointerUp(e, place.id)}
          onPointerCancel={() => closeSwipe(place.id)}
        >
          {/* Top row: icon + name + visit toggle */}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${catInfo.bg}`}>
              {catInfo.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={`font-bold text-[15px] text-foreground truncate ${place.visited ? "line-through opacity-50" : ""}`}>
                  {place.name}
                </h4>
                {place.mustVisit && !place.visited && (
                  <span className="text-[9px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                    لازم نروح!
                  </span>
                )}
                {place.visited && (
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                    ✅ زرناه
                  </span>
                )}
              </div>
              {place.location?.address && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {place.location.address}
                </p>
              )}
            </div>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleVisited(place.id); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                place.visited
                  ? "bg-primary shadow-md"
                  : "border-2 border-muted-foreground/20 hover:border-primary"
              }`}
            >
              {place.visited && <Check size={15} className="text-primary-foreground" />}
            </button>
          </div>

          {/* Info chips row */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-muted/60 text-muted-foreground">
              {place.priceRange}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium ${
              place.kidFriendly === "yes" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
              : place.kidFriendly === "partial" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
            }`}>
              {kidInfo.emoji} {kidInfo.label}
            </span>
            {place.rating && place.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
                <Star size={10} className="fill-current" /> {place.rating}
              </span>
            )}
          </div>

          {/* Note */}
          {place.note && (
            <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed bg-muted/40 rounded-xl px-3 py-2 italic">
              💬 {place.note}
            </p>
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
              icon: <div className="relative">
                <SlidersHorizontal size={18} className="text-white" />
                {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full" />}
              </div>,
              onClick: () => setShowFilters(true),
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
        <div className="px-4 space-y-3">
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

        {/* Filter Drawer */}
        <Drawer open={showFilters} onOpenChange={setShowFilters}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>فلترة الأماكن</DrawerTitle>
              <DrawerDescription>اختر معايير الفلترة</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-5 pb-2 max-h-[60vh] overflow-y-auto">
              {/* Category */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">الفئة</p>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map((cat) => {
                    const isAll = cat === "الكل";
                    const catInfo = !isAll ? CATEGORY_INFO[cat] : null;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                          activeCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {isAll ? "🗺️" : catInfo?.emoji} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Star size={16} className="text-primary" />
                  الحد الأدنى للتقييم
                </p>
                <div className="flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setFilterRating(s === filterRating ? 0 : s)} className="p-1">
                      <Star size={28} className={`transition-colors ${s <= filterRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" />
                  الفئة السعرية
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {([{ value: "الكل" as const, label: "الكل" }, ...([
                    { value: "$" as PriceRange, label: "$" },
                    { value: "$$" as PriceRange, label: "$$" },
                    { value: "$$$" as PriceRange, label: "$$$" },
                    { value: "$$$$" as PriceRange, label: "$$$$" },
                  ])]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterPrice(opt.value)}
                      className={`p-2 rounded-xl border text-xs font-medium transition-all text-center ${
                        filterPrice === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kid Friendly */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Baby size={16} className="text-primary" />
                  مناسب للأطفال؟
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "الكل" as const, label: "الكل", emoji: "🗺️" },
                    { value: "yes" as const, label: "نعم", emoji: "👶" },
                    { value: "partial" as const, label: "جزئياً", emoji: "⚠️" },
                    { value: "no" as const, label: "لا", emoji: "🚫" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterKid(opt.value)}
                      className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${
                        filterKid === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Must Visit */}
              <button
                onClick={() => setFilterMustVisit(!filterMustVisit)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  filterMustVisit ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="text-sm font-medium text-foreground">🔴 لازم نروح فقط</span>
                {filterMustVisit && <Check size={16} className="text-primary" />}
              </button>

              {/* Visit Status */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">حالة الزيارة</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "الكل" as const, label: "الكل" },
                    { value: "unvisited" as const, label: "ما زرناه" },
                    { value: "visited" as const, label: "زرناه ✅" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterVisitStatus(opt.value)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                        filterVisitStatus === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button onClick={() => setShowFilters(false)} className="flex-1 rounded-xl">عرض النتائج</Button>
              <Button variant="outline" onClick={() => { resetFilters(); }} className="flex-1 rounded-xl">إعادة ضبط</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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
        {/* Visit Review Drawer */}
        <Drawer open={!!reviewPlace} onOpenChange={(open) => { if (!open) { setReviewPlace(null); setReviewRating(0); setReviewWouldReturn(null); } }}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>✅ زرت {reviewPlace?.name}؟</DrawerTitle>
              <DrawerDescription>قيّم تجربتك وقلنا رأيك</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-5 pb-2">
              {/* Star Rating */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Star size={16} className="text-primary" />
                  كيف كانت التجربة؟
                </p>
                <div className="flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setReviewRating(s === reviewRating ? 0 : s)} className="p-1">
                      <Star size={32} className={`transition-colors ${s <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <p className="text-center text-xs text-muted-foreground">{reviewRating}/5</p>
                )}
              </div>

              {/* Would return */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <RotateCcw size={16} className="text-primary" />
                  نرجعله مرة ثانية؟
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReviewWouldReturn("yes")}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      reviewWouldReturn === "yes" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    👍 أكيد نرجع!
                  </button>
                  <button
                    onClick={() => setReviewWouldReturn("no")}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      reviewWouldReturn === "no" ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    👎 لا يستاهل
                  </button>
                </div>
              </div>
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button onClick={confirmVisitReview} className="flex-1 rounded-xl">حفظ التقييم</Button>
              <Button variant="outline" onClick={() => { setReviewPlace(null); setReviewRating(0); setReviewWouldReturn(null); }} className="flex-1 rounded-xl">إلغاء</Button>
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
