import { useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListContentSkeleton } from "@/components/PageSkeletons";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { usePlaceLists } from "@/hooks/usePlaceLists";
import FAB from "@/components/FAB";
import { Plus, MapPin, Users, Lock, Share2, Trash2, MoreVertical, Pencil, Check, Star, RotateCcw, SlidersHorizontal, Baby, DollarSign, Phone, Link2, ExternalLink } from "lucide-react";
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
// FAMILY_MEMBERS removed — using useFamilyMembers hook

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

const SWIPE_WIDTH = 140;

const Places = () => {
  const navigate = useNavigate();
  const { members: FAMILY_MEMBERS } = useFamilyMembers();
  const { lists: dbLists, isLoading: placesLoading, createList: createListMut, deleteList: deleteListMut, addPlace: addPlaceMut, updatePlace: updatePlaceMut, deletePlace: deletePlaceMut, updateList: updateListMut } = usePlaceLists();

  const lists: PlaceList[] = useMemo(() => dbLists.map((l: any) => ({
    id: l.id,
    name: l.name,
    type: l.type || "family",
    isDefault: !!l.is_default,
    sharedWith: l.shared_with || [],
    lastUpdatedBy: "",
    lastUpdatedAt: "",
    places: (l.places || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category || "أخرى",
      description: p.description || "",
      location: p.lat && p.lng ? { lat: p.lat, lng: p.lng, address: p.address } : undefined,
      socialLink: p.social_link,
      phone: p.phone,
      priceRange: p.price_range || "$$",
      rating: p.rating,
      kidFriendly: p.kid_friendly || "no",
      addedBy: p.added_by || "",
      suggestedBy: p.suggested_by,
      visited: p.visited || false,
      mustVisit: p.must_visit || false,
      note: p.note || "",
    })),
  })), [dbLists]);

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

  // Detail bottom sheet
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);

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
      const place2 = activeList?.places.find(p => p.id === placeId);
      if (place2) {
        updatePlaceMut.mutate({ id: placeId, visited: false, rating: null });
      }
    }
  }, [activeListId, activeList]);

  const confirmVisitReview = useCallback(() => {
    if (!reviewPlace) return;
    haptic.medium();
    updatePlaceMut.mutate({
      id: reviewPlace.id,
      visited: true,
      rating: reviewRating || null,
      note: reviewWouldReturn === "yes" ? (reviewPlace.note ? reviewPlace.note + " · نرجعله!" : "نرجعله!") : reviewPlace.note,
    });
    setReviewPlace(null);
    setReviewRating(0);
    setReviewWouldReturn(null);
  }, [activeListId, reviewPlace, reviewRating, reviewWouldReturn]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deletePlaceMut.mutate(deleteTarget.id, activeListId);
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  }, [activeListId, deleteTarget]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    const autoType = newListShareMembers.length > 0 ? "family" : "personal";
    createListMut.mutate({ name: newListName.trim(), type: autoType, shared_with: newListShareMembers });
    setNewListName("");
    setNewListShareMembers([]);
    setShowAddList(false);
  }, [newListName, newListShareMembers, createListMut]);

  const deleteList = useCallback((listId: string) => {
    haptic.medium();
    deleteListMut.mutate(listId);
    if (activeListId === listId && lists.length > 1) {
      const remaining = lists.filter(l => l.id !== listId);
      if (remaining.length > 0) setActiveListId(remaining[0].id);
    }
  }, [activeListId, lists, deleteListMut]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0 || !activeListId) return;
    haptic.medium();
    updateListMut.mutate({
      id: activeListId,
      shared_with: selectedShareMembers,
      type: "shared",
    });
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [activeListId, selectedShareMembers, updateListMut]);

  const getListIcon = (type: PlaceList["type"], isActive: boolean) => {
    switch (type) {
      case "family": return <Users size={14} className={isActive ? "text-primary" : "text-white/90"} />;
      case "personal": return <Lock size={14} className={isActive ? "text-accent" : "text-white/90"} />;
      case "shared": return <Share2 size={14} className={isActive ? "text-blue-500" : "text-white/90"} />;
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
          className="relative z-10 bg-card rounded-2xl px-3 py-3 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing shadow-sm"
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, place.id)}
          onPointerMove={(e) => handlePointerMove(e, place.id)}
          onPointerUp={(e) => handlePointerUp(e, place.id)}
          onPointerCancel={() => closeSwipe(place.id)}
          onClick={() => { if ((swipeOffset[place.id] || 0) === 0) setDetailPlace(place); }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${catInfo.bg}`}>
              {catInfo.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className={`font-bold text-sm text-foreground truncate ${place.visited ? "line-through opacity-50" : ""}`}>
                  {place.name}
                </h4>
                {place.mustVisit && !place.visited && (
                  <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                    لازم نروح!
                  </span>
                )}
                {place.visited && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
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

            {/* Right side: kid + price stacked */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                place.kidFriendly === "yes" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : place.kidFriendly === "partial" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
              }`}>
                {kidInfo.emoji} {kidInfo.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-muted/60 text-muted-foreground">
                {place.priceRange} {PRICE_LABELS[place.priceRange]}
              </span>
            </div>

            {/* Visit toggle */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleVisited(place.id); }}
              role="checkbox"
              aria-checked={place.visited}
              aria-label={`تحديد زيارة ${place.name}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                place.visited
                  ? "bg-primary shadow-sm"
                  : "border-2 border-muted-foreground/20 hover:border-primary"
              }`}
            >
              {place.visited && <Check size={14} className="text-primary-foreground" />}
            </button>
          </div>
          {place.note && (
            <p className="text-[11px] text-muted-foreground mt-2 truncate italic">
              💬 {place.note}
            </p>
          )}
        </div>
      </div>
    );
  };

  const placesQueryClient = useQueryClient();
  const handleRefresh = async () => {
    await placesQueryClient.invalidateQueries({ queryKey: ["place-lists"] });
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-28" dir="rtl">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold max-w-[140px] transition-all ${
                  activeListId === list.id
                    ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-md"
                    : "bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                <span className="shrink-0">{getListIcon(list.type, activeListId === list.id)}</span>
                <span className="truncate">{list.name}</span>
                {list.type === "personal" && <Lock size={10} className="shrink-0" />}
              </button>
            ))}
          </div>
        </PageHeader>

      {placesLoading ? (
        <ListContentSkeleton />
      ) : (
      <PullToRefresh onRefresh={handleRefresh}>


        {/* List Actions */}
        {activeList && !activeList.isDefault && (
          <div className="px-4 py-2 flex items-center justify-end">
            <button className="p-1 rounded-lg hover:bg-muted" onClick={() => setShowListActions(true)}>
              <MoreVertical size={16} className="text-muted-foreground" />
            </button>
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

        {/* List Actions Drawer */}
        <Drawer open={showListActions} onOpenChange={setShowListActions}>
          <DrawerContent dir="rtl">
            <DrawerHeader>
              <DrawerTitle>خيارات القائمة</DrawerTitle>
              <DrawerDescription>{activeList?.name}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-2 pb-4">
              {activeList?.type !== "family" && (
                <button
                  onClick={() => { setShowListActions(false); setShowShareDialog(true); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Share2 size={16} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">مشاركة القائمة</span>
                </button>
              )}
              <button
                onClick={() => { setShowListActions(false); if (activeList) deleteList(activeList.id); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <Trash2 size={16} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">حذف القائمة</span>
              </button>
            </div>
          </DrawerContent>
        </Drawer>

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

        {/* Place Detail Drawer */}
        <Drawer open={!!detailPlace} onOpenChange={(open) => { if (!open) setDetailPlace(null); }}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <div className="flex items-center gap-3">
                {detailPlace && (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${CATEGORY_INFO[detailPlace.category].bg}`}>
                    {CATEGORY_INFO[detailPlace.category].emoji}
                  </div>
                )}
                <div>
                  <DrawerTitle>{detailPlace?.name}</DrawerTitle>
                  <DrawerDescription>{detailPlace?.location?.address || detailPlace?.category}</DrawerDescription>
                </div>
              </div>
            </DrawerHeader>
            {detailPlace && (
              <div className="px-4 space-y-3 pb-4 max-h-[55vh] overflow-y-auto">
                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  {detailPlace.mustVisit && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2.5 py-1 rounded-lg font-bold">🔴 لازم نروح!</span>
                  )}
                  {detailPlace.visited && (
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold">✅ زرناه</span>
                  )}
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-lg font-medium text-muted-foreground">
                    {detailPlace.priceRange} {PRICE_LABELS[detailPlace.priceRange]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                    detailPlace.kidFriendly === "yes" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    : detailPlace.kidFriendly === "partial" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                  }`}>
                    {KID_LABELS[detailPlace.kidFriendly].emoji} {KID_LABELS[detailPlace.kidFriendly].label}
                  </span>
                </div>

                {/* Rating */}
                {detailPlace.rating && detailPlace.rating > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                    <Star size={16} className="text-yellow-500" />
                    <span className="text-sm font-medium text-foreground">التقييم</span>
                    <div className="flex items-center gap-0.5 mr-auto">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className={s <= (detailPlace.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Link */}
                {detailPlace.socialLink && (
                  <a
                    href={detailPlace.socialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Link2 size={16} className="text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">زيارة الرابط</span>
                    <ExternalLink size={14} className="text-muted-foreground shrink-0" />
                  </a>
                )}

                {/* Phone */}
                {detailPlace.phone && (
                  <a
                    href={`tel:${detailPlace.phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Phone size={16} className="text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1" dir="ltr">{detailPlace.phone}</span>
                  </a>
                )}

                {/* Location */}
                {detailPlace.location?.address && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <MapPin size={16} className="text-primary shrink-0" />
                    <span className="text-sm text-foreground">{detailPlace.location.address}</span>
                  </div>
                )}

                {/* Note */}
                {detailPlace.note && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">💬 ملاحظة</p>
                    <p className="text-sm text-foreground leading-relaxed">{detailPlace.note}</p>
                  </div>
                )}

                {/* Added by */}
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  أضافه: {detailPlace.addedBy}
                  {detailPlace.suggestedBy && ` · اقترحه: ${detailPlace.suggestedBy}`}
                </p>
              </div>
            )}
            <DrawerFooter className="flex-row gap-2">
              <Button
                onClick={() => {
                  const place = detailPlace;
                  setDetailPlace(null);
                  if (place) navigate(`/places/edit/${place.id}`, { state: { place, listId: activeListId } });
                }}
                variant="outline"
                className="flex-1 rounded-xl gap-2"
              >
                <Pencil size={14} /> تعديل
              </Button>
              <Button
                onClick={() => setDetailPlace(null)}
                className="flex-1 rounded-xl"
              >
                إغلاق
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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
                <p className="text-xs text-muted-foreground mb-2">مشاركة مع (اختياري)</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {FAMILY_MEMBERS.map((member) => (
                    <button
                      key={member.id}
                      onClick={() =>
                        setNewListShareMembers((prev) =>
                          prev.includes(member.name) ? prev.filter((m) => m !== member.name) : [...prev, member.name]
                        )
                      }
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                        newListShareMembers.includes(member.name) ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <span className="font-medium text-foreground">{member.name}</span>
                      {newListShareMembers.includes(member.name) && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
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
                  key={member.id}                  onClick={() =>
                    setSelectedShareMembers((prev) =>
                      prev.includes(member.name) ? prev.filter((m) => m !== member.name) : [...prev, member.name]
                    )
                  }
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                    selectedShareMembers.includes(member.name) ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="font-medium text-foreground">{member.name}</span>
                  {selectedShareMembers.includes(member.name) && <Check size={16} className="text-primary" />}
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
      )}

      <FAB onClick={() => navigate("/places/add", { state: { listId: activeListId } })} />
    </div>
  );
};

export default Places;
