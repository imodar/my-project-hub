import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useTrash } from "@/contexts/TrashContext";
import { useMarketLists } from "@/hooks/useMarketLists";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useToast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";
import { Plus, Search, ShoppingCart, Check, Users, Lock, Share2, Trash2, MoreVertical, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PullToRefresh from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useUserRole } from "@/contexts/UserRoleContext";
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

interface MarketItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  addedBy: string;
  checked: boolean;
}

interface MarketList {
  id: string;
  name: string;
  type: "family" | "personal" | "shared";
  isDefault?: boolean;
  useCategories: boolean;
  sharedWith?: string[];
  items: MarketItem[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; emoji: string }> = {
  "خضار وفاكهة": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", emoji: "🥬" },
  "لحوم": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", emoji: "❤️" },
  "ألبان": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", emoji: "🥛" },
  "مخبوزات": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", emoji: "🍞" },
  "مشروبات": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", emoji: "🥤" },
  "مؤونة": { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", emoji: "🫒" },
  "تنظيف": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", emoji: "🧹" },
  "أخرى": { bg: "bg-muted", text: "text-muted-foreground", emoji: "📦" },
};

const CATEGORIES = ["الكل", ...Object.keys(CATEGORY_COLORS)];
// FAMILY_MEMBERS removed — using useFamilyMembers hook

const SWIPE_WIDTH = 140;
const DEFAULT_FAMILY_LIST_ID = "default-family-list";
const DEFAULT_FAMILY_LIST_NAME = "قائمة العائلة";

const Market = () => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();
  const { members: FAMILY_MEMBERS } = useFamilyMembers();
  const { familyId } = useFamilyId();
  const { toast } = useToast();
  const { addToTrash } = useTrash();
  const { lists: dbLists, isLoading, createList: createListMutation, deleteList: deleteListMutation, addItem: addItemMutation, updateItem: updateItemMutation, deleteItem: deleteItemMutation, pendingItemIds } = useMarketLists();
  const createdDefaultListRef = useRef<string | null>(null);

  const lists: MarketList[] = useMemo(() => {
    const mapped = (dbLists || []).map((l: any) => {
      const listType = (l.type || "family") as "family" | "personal" | "shared";
      const isDefaultFamilyList = listType === "family" && l.name === DEFAULT_FAMILY_LIST_NAME;

      return {
        id: l.id,
        name: l.name,
        type: listType,
        isDefault: isDefaultFamilyList,
        useCategories: isDefaultFamilyList ? true : l.use_categories ?? true,
        sharedWith: l.shared_with || [],
        lastUpdatedBy: "",
        lastUpdatedAt: l.updated_at ? new Date(l.updated_at).toLocaleDateString("ar") : "",
        items: (l.market_items || []).map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category || "أخرى",
          quantity: i.quantity || "1",
          addedBy: "",
          checked: i.checked,
        })),
      };
    });

    const filtered = featureAccess.isStaff ? mapped.filter((list) => list.type !== "family") : mapped;

    if (filtered.length > 0 || featureAccess.isStaff) {
      return filtered;
    }

    return [{
      id: DEFAULT_FAMILY_LIST_ID,
      name: DEFAULT_FAMILY_LIST_NAME,
      type: "family",
      isDefault: true,
      useCategories: true,
      sharedWith: [],
      items: [],
      lastUpdatedBy: "",
      lastUpdatedAt: "",
    }];
  }, [dbLists, featureAccess.isStaff]);
  const [activeListId, setActiveListId] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");

  useEffect(() => {
    createdDefaultListRef.current = null;
  }, [familyId]);

  useEffect(() => {
    if (
      featureAccess.isStaff ||
      !familyId ||
      isLoading ||
      (dbLists?.length ?? 0) > 0 ||
      createdDefaultListRef.current === familyId
    ) {
      return;
    }

    createdDefaultListRef.current = familyId;
    createListMutation.mutate(
      {
        name: DEFAULT_FAMILY_LIST_NAME,
        type: "family",
        shared_with: [],
        use_categories: true,
      },
      {
        onError: () => {
          createdDefaultListRef.current = null;
        },
      }
    );
  }, [familyId, featureAccess.isStaff, isLoading, dbLists, createListMutation]);

  // Auto-select first list when data loads
  useEffect(() => {
    if (lists.length > 0 && (!activeListId || !lists.find(l => l.id === activeListId))) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const activeSwipeRef = useRef<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MarketItem | null>(null);

  // Delete list confirmation
  const [deleteListTarget, setDeleteListTarget] = useState<string | null>(null);

  // Edit item
  const [editTarget, setEditTarget] = useState<MarketItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // New item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("أخرى");
  const [newItemQuantity, setNewItemQuantity] = useState("");

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"family" | "personal">(featureAccess.isStaff ? "personal" : "family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);
  const [newListUseCategories, setNewListUseCategories] = useState(false);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredItems = activeList?.items.filter((item) => {
    const matchesCategory = activeCategory === "الكل" || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.name.includes(searchQuery);
    return matchesCategory && matchesSearch;
  }) || [];

  const uncheckedItems = filteredItems.filter((i) => !i.checked);
  const checkedItems = filteredItems.filter((i) => i.checked);

  const totalItems = activeList?.items.length || 0;
  const completedItems = activeList?.items.filter((i) => i.checked).length || 0;
  const remainingItems = totalItems - completedItems;

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
    // RTL: swipe right reveals actions on the left side (positive diff)
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

  const toggleItem = useCallback((itemId: string) => {
    haptic.light();
    const item = activeList?.items.find(i => i.id === itemId);
    if (item) updateItemMutation.mutate({ id: itemId, checked: !item.checked });
  }, [activeList, updateItemMutation]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deleteItemMutation.mutate(deleteTarget.id);
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  }, [deleteTarget, deleteItemMutation]);

  const openEdit = useCallback((item: MarketItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditCategory(item.category);
    closeSwipe(item.id);
  }, [closeSwipe]);

  const saveEdit = useCallback(() => {
    if (!editTarget || !editName.trim()) return;
    haptic.medium();
    updateItemMutation.mutate({ id: editTarget.id, name: editName.trim(), quantity: editQuantity.trim() || "1", category: editCategory });
    setEditTarget(null);
  }, [editTarget, editName, editQuantity, editCategory, updateItemMutation]);

  const addItem = useCallback(() => {
    if (!newItemName.trim() || !activeList) return;

    if (!familyId || activeList.id === DEFAULT_FAMILY_LIST_ID) {
      toast({
        title: familyId ? "جارٍ تجهيز القائمة العائلية" : "يجب الانضمام لعائلة أولاً",
        variant: "destructive",
      });
      return;
    }

    haptic.medium();
    addItemMutation.mutate({ list_id: activeList.id, name: newItemName.trim(), category: newItemCategory, quantity: newItemQuantity.trim() || "1" });
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemCategory("أخرى");
    setShowAddItem(false);
  }, [activeList, newItemName, newItemCategory, newItemQuantity, addItemMutation, familyId, toast]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    if (!familyId) {
      toast({ title: "يجب الانضمام لعائلة أولاً", variant: "destructive" });
      return;
    }
    haptic.medium();
    createListMutation.mutate(
      {
        name: newListName.trim(),
        type: newListType === "family" && newListShareMembers.length > 0 ? "shared" : newListType,
        shared_with: newListType === "family" ? newListShareMembers : [],
        use_categories: newListUseCategories,
      },
      {
        onSuccess: (data) => {
          if (data?.id) setActiveListId(data.id);
        },
      }
    );
    setNewListName("");
    setNewListShareMembers([]);
    setNewListUseCategories(false);
    setShowAddList(false);
  }, [newListName, newListType, newListShareMembers, createListMutation, familyId, toast]);

  const deleteList = useCallback((listId: string) => {
    setDeleteListTarget(listId);
  }, []);

  const confirmDeleteList = useCallback(() => {
    if (!deleteListTarget) return;
    haptic.medium();

    // Find the full list data to save to trash
    const listToDelete = dbLists.find((l: any) => l.id === deleteListTarget);
    if (listToDelete) {
      addToTrash({
        type: "market_list",
        title: listToDelete.name,
        description: `${(listToDelete as any).market_items?.length || 0} منتج`,
        deletedBy: "",
        isShared: listToDelete.type === "family",
        originalData: {
          id: listToDelete.id,
          name: listToDelete.name,
          type: listToDelete.type,
          family_id: listToDelete.family_id,
          created_by: listToDelete.created_by,
          shared_with: listToDelete.shared_with,
          use_categories: listToDelete.use_categories,
        },
        relatedRecords: (listToDelete as any).market_items || [],
      });
    }

    deleteListMutation.mutate(deleteListTarget);
    setDeleteListTarget(null);
    toast({ title: "تم نقل القائمة إلى سلة المحذوفات" });
  }, [deleteListTarget, deleteListMutation, dbLists, addToTrash, toast]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0) return;
    haptic.medium();
    // TODO: add updateList mutation for sharing
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [selectedShareMembers]);

  const getListIcon = (type: MarketList["type"], isActive: boolean) => {
    switch (type) {
      case "family": return <Users size={14} className={isActive ? "text-primary" : "text-white/90"} />;
      case "personal": return <Lock size={14} className={isActive ? "text-accent" : "text-white/90"} />;
      case "shared": return <Share2 size={14} className={isActive ? "text-blue-500" : "text-white/90"} />;
    }
  };

  const renderItem = (item: MarketItem, isChecked: boolean) => {
    const catInfo = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["أخرى"];
    const offset = swipeOffset[item.id] || 0;

    return (
      <div key={item.id} className="relative overflow-hidden rounded-2xl select-none">
        {/* Swipe actions behind - positioned on the left side */}
        <div
          className="absolute left-0 top-0 bottom-0 flex items-stretch gap-1 rounded-2xl overflow-hidden p-1"
          style={{ width: `${SWIPE_WIDTH}px` }}
        >
          <button
            onClick={() => { setDeleteTarget(item); closeSwipe(item.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 transition-colors rounded-xl"
          >
            <Trash2 size={16} className="text-destructive-foreground" />
            <span className="text-[10px] text-destructive-foreground font-semibold">حذف</span>
          </button>
          <button
            onClick={() => openEdit(item)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors rounded-xl"
            style={{ background: "hsl(220, 60%, 50%)" }}
          >
            <Pencil size={16} className="text-white" />
            <span className="text-[10px] text-white font-semibold">تعديل</span>
          </button>
        </div>

        {/* Card */}
        <div
          className={`relative z-10 bg-card rounded-2xl p-3 flex items-center gap-3 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing`}
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, item.id)}
          onPointerMove={(e) => handlePointerMove(e, item.id)}
          onPointerUp={(e) => handlePointerUp(e, item.id)}
          onPointerCancel={() => closeSwipe(item.id)}
        >
          <div className="relative shrink-0 w-7 h-7">
            {pendingItemIds.includes(item.id) && (
              <div className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
            )}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-primary"
                  : "border-2 border-border hover:border-primary"
              }`}
            >
              {isChecked && <Check size={14} className="text-primary-foreground" />}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm text-foreground truncate ${isChecked ? "line-through" : ""}`}>
              {item.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isChecked ? item.quantity : `الكمية: ${item.quantity}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catInfo.bg} ${catInfo.text}`}>
              {item.category}
            </span>
            <span className="text-[10px] text-muted-foreground">{item.addedBy}</span>
          </div>
        </div>
      </div>
    );
  };

    const handleRefresh = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    };

    return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-28" dir="rtl">
      
      <PageHeader
        title="أغراض السوق"
        actions={[
          ...(activeList && !activeList.isDefault
            ? [{
                icon: <MoreVertical size={20} className="text-white" />,
                onClick: () => { haptic.light(); setShowListActions(true); },
              }]
            : []),
          {
            icon: <Plus size={20} className="text-white" />,
            onClick: () => setShowAddList(true),
          },
        ]}
      >
        {/* Lists tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-3 scrollbar-hide">
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
              {getListIcon(list.type, activeListId === list.id)}
              {list.name}
            </button>
          ))}
        </div>
      </PageHeader>

      <PullToRefresh onRefresh={handleRefresh}>
      {isLoading ? (
        <div className="px-4 py-4 space-y-3">
          {/* Stats skeleton */}
          <div className="flex items-center justify-between py-2">
            <div className="flex gap-3">
              <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
          {/* Search skeleton */}
          <div className="h-10 rounded-xl bg-muted animate-pulse" />
          {/* Category skeleton */}
          <div className="flex gap-2 overflow-hidden py-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-muted animate-pulse shrink-0" />
            ))}
          </div>
          {/* Items skeleton */}
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
      {/* Stats bar */}
      {activeList && (
        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-background">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {remainingItems} متبقي
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {completedItems} مكتمل
            </span>
          </div>
          <div className="flex items-center gap-2" />
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث في القائمة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 bg-card border-border rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Category filters - show based on list's useCategories setting */}
      {activeList?.useCategories && (
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const isAll = cat === "الكل";
          const catInfo = CATEGORY_COLORS[cat];
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
              {!isAll && catInfo && <span>{catInfo.emoji}</span>}
              {isAll && "🛒"}
              {cat}
            </button>
          );
        })}
      </div>
      )}

      {/* Items list */}
      <div className="px-4 pt-4 space-y-2 pb-4">
        {uncheckedItems.map((item) => renderItem(item, false))}

        {checkedItems.length > 0 && (
          <div className="pt-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">✅ تم شراؤها</p>
            <div className="space-y-2">
              {checkedItems.map((item) => renderItem(item, true))}
            </div>
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد أغراض</p>
          </div>
        )}
      </div>
      </>
      )}
      </PullToRefresh>

      {/* Floating add button - portal to escape transform context */}
      {createPortal(
        <div className="fixed bottom-24 left-4 max-w-2xl mx-auto z-30">
          <Button
            onClick={() => {
              haptic.medium();
              setShowAddItem(true);
            }}
            className="w-14 h-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 p-0"
            size="icon"
          >
            <Plus size={24} />
          </Button>
        </div>,
        document.body
      )}

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
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
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

      {/* Delete List Confirmation */}
      <Drawer open={!!deleteListTarget} onOpenChange={(open) => !open && setDeleteListTarget(null)}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>حذف القائمة</DrawerTitle>
            <DrawerDescription>
              هل أنت متأكد من حذف هذه القائمة وجميع منتجاتها؟ لا يمكن التراجع عن هذا الإجراء.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-row gap-2 pb-6">
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={confirmDeleteList}
            >
              <Trash2 size={16} className="ml-2" />
              حذف القائمة
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setDeleteListTarget(null)}
            >
              إلغاء
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>


      <Drawer open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>تعديل المنتج</DrawerTitle>
            <DrawerDescription>عدّل اسم المنتج والكمية والتصنيف</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4">
            <Input
              placeholder="اسم المنتج"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl"
            />
            <Input
              placeholder="الكمية"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              className="rounded-xl"
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">التصنيف</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_COLORS).map(([cat, info]) => (
                  <button
                    key={cat}
                    onClick={() => setEditCategory(cat)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      editCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : `${info.bg} ${info.text} border border-border`
                    }`}
                  >
                    {info.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button onClick={saveEdit} className="flex-1 rounded-xl">حفظ</Button>
            <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl">إلغاء</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Item Drawer */}
      <Drawer open={showAddItem} onOpenChange={setShowAddItem}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>إضافة منتج جديد</DrawerTitle>
            <DrawerDescription>أضف المنتج مع التصنيف والكمية</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4">
            <Input placeholder="اسم المنتج" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="rounded-xl" />
            <Input placeholder="الكمية (مثال: 2 كيلو)" value={newItemQuantity} onChange={(e) => setNewItemQuantity(e.target.value)} className="rounded-xl" />
            <div>
              <p className="text-xs text-muted-foreground mb-2">التصنيف</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_COLORS).map(([cat, info]) => (
                  <button
                    key={cat}
                    onClick={() => setNewItemCategory(cat)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      newItemCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : `${info.bg} ${info.text} border border-border`
                    }`}
                  >
                    {info.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button onClick={addItem} className="flex-1 rounded-xl">إضافة</Button>
            <Button variant="outline" onClick={() => setShowAddItem(false)} className="flex-1 rounded-xl">إلغاء</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add List Drawer */}
      <Drawer open={showAddList} onOpenChange={setShowAddList}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right">
            <DrawerTitle>إنشاء قائمة جديدة</DrawerTitle>
            <DrawerDescription>أنشئ قائمة تسوق جديدة</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4">
            <Input placeholder="اسم القائمة" value={newListName} onChange={(e) => setNewListName(e.target.value)} className="rounded-xl" />
            {!featureAccess.isStaff && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">نوع القائمة</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewListType("family")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    newListType === "family" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Users size={16} /> عائلية
                </button>
                <button
                  onClick={() => setNewListType("personal")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    newListType === "personal" ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Lock size={16} /> شخصية
                </button>
              </div>
            </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">إظهار فئات التسوق الافتراضية</p>
                <p className="text-[11px] text-muted-foreground">خضار وفاكهة، لحوم، ألبان، مخبوزات...</p>
              </div>
              <Switch checked={newListUseCategories} onCheckedChange={setNewListUseCategories} />
            </div>
            {newListType === "family" && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">مشاركة مع</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {FAMILY_MEMBERS.map((member) => (
                    <button
                      key={member.id}                      onClick={() =>
                        setNewListShareMembers((prev) =>
                          prev.includes(member.name) ? prev.filter((m) => m !== member.name) : [...prev, member.name]
                        )
                      }
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                        newListShareMembers.includes(member.name)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="font-medium text-foreground">{member.name}</span>
                      {newListShareMembers.includes(member.name) && <Check size={14} className="text-primary" />}
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
          <div className="space-y-2 px-4">
            {FAMILY_MEMBERS.map((member) => (
              <button
                key={member.id}                onClick={() =>
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
    
    </div>
  );
};

export default Market;
