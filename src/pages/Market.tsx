import { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useTrash } from "@/contexts/TrashContext";
import { useMarketLists } from "@/hooks/useMarketLists";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import FAB from "@/components/FAB";
import SwipeableCard from "@/components/SwipeableCard";
import { Plus, Search, ShoppingCart, Check, Users, Lock, Share2, Trash2, MoreVertical, Pencil, GripVertical } from "lucide-react";
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
  "بدون تصنيف": { bg: "bg-muted", text: "text-muted-foreground", emoji: "📦" },
  "خضار وفاكهة": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", emoji: "🥬" },
  "لحوم": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", emoji: "🥩" },
  "ألبان": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", emoji: "🥛" },
  "مخبوزات": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", emoji: "🍞" },
  "مشروبات": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", emoji: "🥤" },
  "مؤونة": { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", emoji: "🫒" },
  "تنظيف": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", emoji: "🧹" },
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
  const { addToTrash } = useTrash();
  const { lists: dbLists, isLoading, isSyncing, createList: createListMutation, deleteList: deleteListMutation, addItem: addItemMutation, updateItem: updateItemMutation, deleteItem: deleteItemMutation, updateList: updateListMutation, pendingItemIds } = useMarketLists();
  const createdDefaultListRef = useRef<string | null>(null);

  const lists: MarketList[] = useMemo(() => {
    const mapped = (dbLists || []).map((l: any) => {
      const listType = (l.type || "family") as "family" | "personal" | "shared";
      const isDefaultFamilyList = !!l.is_default;

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
          quantity: i.quantity || "",
          addedBy: i.added_by ? (FAMILY_MEMBERS.find(m => m.id === i.added_by)?.name || "") : "",
          checked: i.checked,
        })),
      };
    });

    // Sort oldest first (oldest on the right in RTL)
    mapped.sort((a, b) => {
      const da = (dbLists || []).find((l: any) => l.id === a.id)?.created_at || "";
      const db2 = (dbLists || []).find((l: any) => l.id === b.id)?.created_at || "";
      return da.localeCompare(db2);
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
  }, [dbLists, featureAccess.isStaff, FAMILY_MEMBERS]);
  const [activeListId, setActiveListId] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");
  const pendingActiveListIdRef = useRef<string | null>(null);

  useEffect(() => {
    createdDefaultListRef.current = null;
    pendingActiveListIdRef.current = null;
  }, [familyId]);

  useEffect(() => {
    const hasFamilyList = (dbLists || []).some((l: any) => l.type === "family");
    if (
      featureAccess.isStaff ||
      !familyId ||
      isLoading ||
      isSyncing ||
      hasFamilyList ||
      createdDefaultListRef.current === familyId ||
      createListMutation.isPending
    ) {
      return;
    }

    createListMutation.mutate(
      {
        name: DEFAULT_FAMILY_LIST_NAME,
        type: "family",
        shared_with: [],
        use_categories: true,
      },
      {
        onSuccess: () => { createdDefaultListRef.current = familyId; },
        onError: () => { createdDefaultListRef.current = null; },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, featureAccess.isStaff, isLoading, isSyncing, dbLists]);

  // Auto-select first list when data loads, but don't override a just-created optimistic list
  useEffect(() => {
    if (pendingActiveListIdRef.current) {
      if (lists.some((l) => l.id === pendingActiveListIdRef.current)) {
        setActiveListId(pendingActiveListIdRef.current);
      }
      return;
    }

    if (lists.length > 0 && (!activeListId || !lists.find(l => l.id === activeListId))) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const [openCardId, setOpenCardId] = useState<string | null>(null);

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
  // Ref to read actual DOM value when Android IME composition hasn't committed to React state yet
  const newItemNameRef = useRef("");
  const newListNameRef = useRef("");

  // Draft persistence للنموذج
  const marketDraft = useDraftPersistence<{
    name: string; category: string; quantity: string;
  }>(`market-add-${activeListId}`);

  // Pagination
  const PAGE_SIZE = 30;
  const [visibleUncheckedCount, setVisibleUncheckedCount] = useState(PAGE_SIZE);
  const [visibleCheckedCount, setVisibleCheckedCount] = useState(PAGE_SIZE);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);
  const [newListUseCategories, setNewListUseCategories] = useState(false);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);

  const activeList = lists.find((l) => l.id === activeListId);

  // إعادة تعيين الصفحات عند تغيير القائمة أو الفلتر
  useEffect(() => {
    setVisibleUncheckedCount(PAGE_SIZE);
    setVisibleCheckedCount(PAGE_SIZE);
  }, [activeListId, searchQuery, activeCategory]);

  const filteredItems = activeList?.items.filter((item) => {
    const matchesCategory = activeCategory === "الكل" || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.name.includes(searchQuery);
    return matchesCategory && matchesSearch;
  }) || [];

  const uncheckedItems = filteredItems.filter((i) => !i.checked);
  const checkedItems = filteredItems.filter((i) => i.checked);

  const visibleUncheckedItems = uncheckedItems.slice(0, visibleUncheckedCount);
  const visibleCheckedItems = checkedItems.slice(0, visibleCheckedCount);

  const totalItems = activeList?.items.length || 0;
  const completedItems = activeList?.items.filter((i) => i.checked).length || 0;
  const remainingItems = totalItems - completedItems;

  // Swipe handlers moved to SwipeableCard component

  const toggleItem = useCallback((itemId: string) => {
    haptic.light();
    const item = activeList?.items.find(i => i.id === itemId);
    if (item) updateItemMutation.mutate({ id: itemId, checked: !item.checked });
  }, [activeList, updateItemMutation]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deleteItemMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteItemMutation]);

  const openEdit = useCallback((item: MarketItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditCategory(item.category);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editTarget || !editName.trim()) return;
    haptic.medium();
    updateItemMutation.mutate({ id: editTarget.id, name: editName.trim(), quantity: editQuantity.trim() || undefined, category: editCategory });
    setEditTarget(null);
  }, [editTarget, editName, editQuantity, editCategory, updateItemMutation]);

  const addItem = useCallback(() => {
    // Read from ref first — handles Android IME composition where React state lags behind DOM
    const name = (newItemNameRef.current || newItemName).trim();
    if (!name) { appToast.error("أدخل اسم المنتج"); return; }
    if (!activeList) { appToast.error("اختر قائمة أولاً"); return; }

    if (!familyId || activeList.id === DEFAULT_FAMILY_LIST_ID) {
      appToast.error(familyId ? "جارٍ تجهيز القائمة العائلية" : "يجب الانضمام لعائلة أولاً");
      return;
    }

    haptic.medium();
    addItemMutation.mutate({ list_id: activeList.id, name, category: newItemCategory, quantity: newItemQuantity.trim() || undefined });
    newItemNameRef.current = "";
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemCategory("أخرى");
    setShowAddItem(false);
  }, [activeList, newItemName, newItemCategory, newItemQuantity, addItemMutation, familyId]);

  const addList = useCallback(() => {
    // Read from ref first — handles Android IME composition where React state lags behind DOM
    const name = (newListNameRef.current || newListName).trim();
    if (!name) { appToast.error("أدخل اسم القائمة"); return; }
    if (!familyId) {
      appToast.error("يجب الانضمام لعائلة أولاً");
      return;
    }
    haptic.medium();
    const newId = crypto.randomUUID();
    pendingActiveListIdRef.current = newId;
    setActiveListId(newId);
    const autoType = newListShareMembers.length > 0 ? "family" : "personal";
    createListMutation.mutate(
      {
        name,
        type: autoType,
        shared_with: newListShareMembers,
        use_categories: newListUseCategories,
        id: newId,
      },
      {
        onSuccess: () => {
          pendingActiveListIdRef.current = null;
        },
        onError: () => {
          pendingActiveListIdRef.current = null;
        },
      }
    );
    newListNameRef.current = "";
    setNewListName("");
    setNewListShareMembers([]);
    setNewListUseCategories(false);
    setShowAddList(false);
  }, [newListName, newListShareMembers, newListUseCategories, createListMutation, familyId]);

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
    appToast.success("تم نقل القائمة إلى سلة المحذوفات");
  }, [deleteListTarget, deleteListMutation, dbLists, addToTrash]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0 || !activeListId) return;
    haptic.medium();
    updateListMutation.mutate({
      id: activeListId,
      shared_with: selectedShareMembers,
      type: "shared",
    });
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [activeListId, selectedShareMembers, updateListMutation]);

  const getListIcon = (type: MarketList["type"], isActive: boolean) => {
    switch (type) {
      case "family": return <Users size={14} className={isActive ? "text-primary" : "text-white/90"} />;
      case "personal": return <Lock size={14} className={isActive ? "text-accent" : "text-white/90"} />;
      case "shared": return <Share2 size={14} className={isActive ? "text-blue-500" : "text-white/90"} />;
    }
  };

  const renderItem = (item: MarketItem, isChecked: boolean) => {
    const catInfo = CATEGORY_COLORS[item.category] || CATEGORY_COLORS["أخرى"];

    return (
      <SwipeableCard
        key={item.id}
        onSwipeOpen={() => setOpenCardId(item.id)}
        actions={[
          { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => openEdit(item) },
          { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => setDeleteTarget(item) },
        ]}
      >
        <div className={`min-h-[68px] rounded-2xl px-3 py-3 flex items-center gap-3 transition-colors border ${isChecked ? "bg-muted border-dashed border-border" : "bg-white border-border/60"}`}>
          <div className="relative shrink-0 w-7 h-7">
            {pendingItemIds.includes(item.id) && (
              <div className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
            )}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              role="checkbox"
              aria-checked={isChecked}
              aria-label={`تحديد ${item.name}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isChecked
                  ? "bg-primary"
                  : "bg-card border-2 border-border hover:border-primary"
              }`}
            >
              {isChecked && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-[17px] leading-tight text-foreground truncate ${isChecked ? "line-through" : ""}`}>
              {item.name}
            </p>
            <p className="text-[13px] text-muted-foreground mt-0.5 min-h-[18px]">
              {item.quantity ? (isChecked ? item.quantity : `الكمية: ${item.quantity}`) : "\u00A0"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catInfo.bg} ${catInfo.text}`}>
              {item.category}
            </span>
            <span className="text-[10px] text-muted-foreground">{item.addedBy}</span>
          </div>
          <div className="shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none" aria-label="سحب لإعادة الترتيب">
            <GripVertical size={18} />
          </div>
        </div>
      </SwipeableCard>
    );
  };

    const marketQueryClient = useQueryClient();
    const handleRefresh = async () => {
      await marketQueryClient.invalidateQueries({ queryKey: ["market-lists"] });
    };

    return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
      
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
            icon: <Search size={20} className="text-white" />,
            onClick: () => { haptic.light(); setShowSearch(s => !s); if (showSearch) setSearchQuery(""); },
          },
          {
            icon: <Plus size={20} className="text-white" />,
            onClick: () => setShowAddList(true),
          },
        ]}
      >
        {/* Lists tabs — underline style with mouse drag-to-scroll */}
        <div
          className="flex gap-5 overflow-x-auto mt-4 pt-1 scrollbar-hide cursor-grab active:cursor-grabbing select-none"
          onMouseDown={(e) => {
            const el = e.currentTarget;
            const startX = e.pageX;
            const startScroll = el.scrollLeft;
            let moved = false;
            const onMove = (ev: MouseEvent) => {
              const dx = ev.pageX - startX;
              if (Math.abs(dx) > 3) moved = true;
              el.scrollLeft = startScroll - dx;
            };
            const onUp = (ev: MouseEvent) => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              if (moved) {
                ev.preventDefault();
                const blockClick = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); document.removeEventListener("click", blockClick, true); };
                document.addEventListener("click", blockClick, true);
              }
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        >
          {lists.map((list) => {
            const isActive = activeListId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => {
                  haptic.light();
                  setActiveListId(list.id);
                  setActiveCategory("الكل");
                }}
                className={`relative shrink-0 flex items-center gap-1.5 pb-2 text-sm transition-colors ${
                  isActive ? "text-white font-bold" : "text-white/60 font-medium hover:text-white/80"
                }`}
              >
                <span className="shrink-0">{getListIcon(list.type, false)}</span>
                <span className="truncate max-w-[140px]">{list.name}</span>
                {isActive && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-pink-500" />
                )}
              </button>
            );
          })}
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
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${showSearch ? "max-h-16 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={(el) => { if (el && showSearch) el.focus(); }}
              placeholder="ابحث في القائمة..."
              aria-label="بحث في القائمة"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => { setShowSearch(false); setSearchQuery(""); }}
              className="pr-9 bg-card border-border rounded-xl text-sm"
            />
          </div>
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
        {visibleUncheckedItems.map((item) => renderItem(item, false))}

        {uncheckedItems.length > visibleUncheckedCount && (
          <button
            onClick={() => setVisibleUncheckedCount((n) => n + PAGE_SIZE)}
            className="w-full py-2.5 text-xs text-primary font-semibold rounded-xl border border-primary/30 hover:bg-primary/5 transition-colors"
          >
            تحميل {Math.min(PAGE_SIZE, uncheckedItems.length - visibleUncheckedCount)} منتج إضافي
          </button>
        )}

        {checkedItems.length > 0 && (
          <div className="space-y-2">
            {visibleCheckedItems.map((item) => renderItem(item, true))}
            {checkedItems.length > visibleCheckedCount && (
              <button
                onClick={() => setVisibleCheckedCount((n) => n + PAGE_SIZE)}
                className="w-full mt-2 py-2 text-xs text-muted-foreground font-medium rounded-xl border border-border hover:bg-muted/50 transition-colors"
              >
                تحميل {Math.min(PAGE_SIZE, checkedItems.length - visibleCheckedCount)} إضافية
              </button>
            )}
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted/50 rounded-full p-4 mb-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">لا توجد أغراض</p>
            <p className="text-xs text-muted-foreground/70 mt-1">أضف أغراض لقائمة التسوق</p>
          </div>
        )}
      </div>
      </>
      )}
      </PullToRefresh>

      <FAB onClick={() => {
        haptic.medium();
        const draft = marketDraft.loadDraft();
        setNewItemName(draft?.name ?? "");
        setNewItemCategory(draft?.category ?? "أخرى");
        setNewItemQuantity(draft?.quantity ?? "");
        setShowAddItem(true);
      }} />

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
      <Drawer open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerHeader>
            <DrawerTitle className="text-center font-black">حذف المنتج</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 space-y-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }} dir="rtl">
            <p className="text-right text-sm text-muted-foreground break-words">
              هل أنت متأكد من حذف "<span className="font-medium text-foreground">{deleteTarget?.name}</span>"؟
            </p>
            <div className="flex gap-2">
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                حذف
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

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
      <Drawer open={showAddItem} onOpenChange={(open) => {
        if (!open) marketDraft.clearDraft();
        setShowAddItem(open);
        if (!open) {
          setNewItemName("");
          setNewItemQuantity("");
          setNewItemCategory("أخرى");
        }
      }}>
        <DrawerContent dir="rtl">
          <DrawerHeader className="text-right pb-1">
            <DrawerTitle className="text-lg">إضافة منتج جديد</DrawerTitle>
            <DrawerDescription className="text-xs">اكتب الاسم والكمية واختر التصنيف</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto space-y-5 px-4 pb-3">
            {activeList?.useCategories && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-sm font-bold text-foreground">التصنيف</p>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                    {CATEGORY_COLORS[newItemCategory]?.emoji} {newItemCategory}
                  </span>
                </div>
                {/* Grid — all categories visible at once */}
                <div className="grid grid-cols-4 gap-2.5">
                  {Object.entries(CATEGORY_COLORS).map(([cat, info]) => {
                    const isActive = newItemCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setNewItemCategory(cat)}
                        className={`group relative flex flex-col items-center gap-1.5 py-2 transition-all duration-300 ${
                          isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div
                          className={`relative w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl transition-all duration-300 ${info.bg} ${
                            isActive
                              ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg"
                              : "ring-0"
                          }`}
                        >
                          {info.emoji}
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                              <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center transition-all ${
                          isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        }`}>
                          {cat}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Big stacked inputs — bordered card style, equal heights */}
            <div className="rounded-3xl border-2 border-border bg-card overflow-hidden divide-y divide-border">
              <div className="relative">
                <label className="absolute right-4 top-2.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">المنتج</label>
                <Input
                  placeholder="مثال: طماطم طازجة"
                  value={newItemName}
                  onChange={(e) => { newItemNameRef.current = e.target.value; setNewItemName(e.target.value); marketDraft.saveDraft({ name: e.target.value, category: newItemCategory, quantity: newItemQuantity }); }}
                  onInput={(e) => { const v = (e.target as HTMLInputElement).value; newItemNameRef.current = v; }}
                  className="h-[68px] border-0 rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-4 focus-visible:ring-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
                />
              </div>
              <div className="relative">
                <label className="absolute right-4 top-2.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">الكمية</label>
                <Input
                  placeholder="مثال: 2 كيلو"
                  value={newItemQuantity}
                  onChange={(e) => { setNewItemQuantity(e.target.value); marketDraft.saveDraft({ name: newItemName, category: newItemCategory, quantity: e.target.value }); }}
                  className="h-[68px] border-0 rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-4 focus-visible:ring-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
                />
              </div>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2 pt-3">
            <Button variant="outline" onClick={() => { marketDraft.clearDraft(); setShowAddItem(false); }} className="flex-1 rounded-2xl h-12">إلغاء</Button>
            <Button onClick={() => { marketDraft.clearDraft(); addItem(); }} className="flex-[2] rounded-2xl h-12 font-bold text-base shadow-md">
              <Plus size={18} className="ml-1" />
              إضافة المنتج
            </Button>
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
          <div className="space-y-3 px-4" data-vaul-no-drag>
            <Input placeholder="اسم القائمة" value={newListName}
              onChange={(e) => { newListNameRef.current = e.target.value; setNewListName(e.target.value); }}
              onInput={(e) => { const v = (e.target as HTMLInputElement).value; newListNameRef.current = v; }}
              className="rounded-xl" />
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">إظهار فئات التسوق الافتراضية</p>
                <p className="text-[11px] text-muted-foreground">خضار وفاكهة، لحوم، ألبان، مخبوزات...</p>
              </div>
              <Switch checked={newListUseCategories} onCheckedChange={setNewListUseCategories} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">مشاركة مع (اختياري)</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {FAMILY_MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    onClick={() =>
                      setNewListShareMembers((prev) =>
                        prev.includes(member.id) ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                      )
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                      newListShareMembers.includes(member.id)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="font-medium text-foreground">{member.name}</span>
                    {newListShareMembers.includes(member.id) && <Check size={14} className="text-primary" />}
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
          <div className="space-y-2 px-4">
            {FAMILY_MEMBERS.map((member) => (
              <button
                key={member.id}
                onClick={() =>
                  setSelectedShareMembers((prev) =>
                    prev.includes(member.id) ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                  )
                }
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                  selectedShareMembers.includes(member.id) ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="font-medium text-foreground">{member.name}</span>
                {selectedShareMembers.includes(member.id) && <Check size={16} className="text-primary" />}
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
