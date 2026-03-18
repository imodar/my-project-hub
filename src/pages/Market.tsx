import { useState, useCallback, useRef } from "react";
import { ArrowRight, Plus, Search, ShoppingCart, Check, Users, Lock, Share2, Trash2, MoreVertical, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
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
  useDefaultCategories?: boolean;
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
const FAMILY_MEMBERS = ["أبو فهد", "أم فهد", "فهد", "نورة", "سارة"];

const initialLists: MarketList[] = [
  {
    id: "1",
    name: "قائمة التسوق",
    type: "family",
    isDefault: true,
    lastUpdatedBy: "أم فهد",
    lastUpdatedAt: "منذ ساعة",
    items: [
      { id: "i1", name: "حليب نادك 1 لتر", category: "ألبان", quantity: "3", addedBy: "أم فهد", checked: false },
      { id: "i2", name: "خيار وطماطم", category: "خضار وفاكهة", quantity: "كيلو من كل", addedBy: "أبو فهد", checked: false },
      { id: "i3", name: "دجاج كامل", category: "لحوم", quantity: "قطعتان", addedBy: "أم فهد", checked: false },
      { id: "i4", name: "زيت زيتون", category: "مؤونة", quantity: "750 مل", addedBy: "أبو فهد", checked: false },
      { id: "i5", name: "خبز تميس", category: "مخبوزات", quantity: "3 أرغفة", addedBy: "أم فهد", checked: true },
      { id: "i6", name: "عصير برتقال", category: "مشروبات", quantity: "7 لتر", addedBy: "أم فهد", checked: true },
    ],
  },
  {
    id: "2",
    name: "أغراضي الشخصية",
    type: "personal",
    lastUpdatedBy: "أبو فهد",
    lastUpdatedAt: "أمس",
    items: [
      { id: "i7", name: "شامبو", category: "أخرى", quantity: "1", addedBy: "أبو فهد", checked: false },
      { id: "i8", name: "معجون أسنان", category: "أخرى", quantity: "2", addedBy: "أبو فهد", checked: false },
    ],
  },
];

const SWIPE_WIDTH = 140;

const Market = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<MarketList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(lists[0]?.id || "");
  const [activeCategory, setActiveCategory] = useState("الكل");
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
  const [newListType, setNewListType] = useState<"family" | "personal">("family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);
  const [newListUseCategories, setNewListUseCategories] = useState(false);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);

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
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item) }
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
          ? { ...list, items: list.items.filter((i) => i.id !== deleteTarget.id) }
          : list
      )
    );
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  }, [activeListId, deleteTarget]);

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
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === editTarget.id
                  ? { ...item, name: editName.trim(), quantity: editQuantity.trim() || "1", category: editCategory }
                  : item
              ),
            }
          : list
      )
    );
    setEditTarget(null);
  }, [activeListId, editTarget, editName, editQuantity, editCategory]);

  const addItem = useCallback(() => {
    if (!newItemName.trim()) return;
    haptic.medium();
    const newItem: MarketItem = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: newItemQuantity.trim() || "1",
      addedBy: "أنت",
      checked: false,
    };
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, items: [...list.items, newItem], lastUpdatedBy: "أنت", lastUpdatedAt: "الآن" }
          : list
      )
    );
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemCategory("أخرى");
    setShowAddItem(false);
  }, [activeListId, newItemName, newItemCategory, newItemQuantity]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    const newList: MarketList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      type: newListType === "family" && newListShareMembers.length > 0 ? "shared" : newListType,
      sharedWith: newListType === "family" ? newListShareMembers : undefined,
      useDefaultCategories: newListType === "personal" ? newListUseCategories : true,
      lastUpdatedBy: "أنت",
      lastUpdatedAt: "الآن",
      items: [],
    };
    setLists((prev) => [...prev, newList]);
    setActiveListId(newList.id);
    setNewListName("");
    setNewListShareMembers([]);
    setNewListUseCategories(false);
    setShowAddList(false);
  }, [newListName, newListType, newListShareMembers, newListUseCategories]);

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

  const getListIcon = (type: MarketList["type"]) => {
    switch (type) {
      case "family": return <Users size={14} className="text-primary" />;
      case "personal": return <Lock size={14} className="text-accent" />;
      case "shared": return <Share2 size={14} className="text-blue-500" />;
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
          className={`relative z-10 bg-card border border-border rounded-2xl p-3 flex items-center gap-3 transition-transform duration-200 ease-out cursor-grab active:cursor-grabbing`}
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, item.id)}
          onPointerMove={(e) => handlePointerMove(e, item.id)}
          onPointerUp={(e) => handlePointerUp(e, item.id)}
          onPointerCancel={() => closeSwipe(item.id)}
        >
          <button
            onClick={() => toggleItem(item.id)}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isChecked
                ? "bg-primary"
                : "border-2 border-border hover:border-primary"
            }`}
          >
            {isChecked && <Check size={14} className="text-primary-foreground" />}
          </button>
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

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-28" dir="rtl">
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 pt-4 pb-3"
        style={{
          background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white/80 hover:text-white">
            <ArrowRight size={22} />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingCart size={22} />
            أغراض السوق
          </h1>
          <button
            onClick={() => setShowAddList(true)}
            className="p-2 rounded-xl text-white/80 hover:text-white"
          >
            <Plus size={22} />
          </button>
        </div>

        {/* Lists tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {activeList && (
        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-card">
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {activeList.lastUpdatedBy} – {activeList.lastUpdatedAt}
            </span>
            {/* Only show menu for non-default lists */}
            {!activeList.isDefault && (
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
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteList(activeList.id)}
                  >
                    <Trash2 size={14} className="ml-2" />
                    حذف القائمة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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

      {/* Category filters */}
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

      {/* Items list */}
      <div className="px-4 space-y-2">
        {uncheckedItems.map((item) => renderItem(item, false))}

        {checkedItems.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2 font-medium">✅ تم شراؤها</p>
            {checkedItems.map((item) => renderItem(item, true))}
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد أغراض</p>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <div className="fixed bottom-24 left-4 right-4 max-w-2xl mx-auto z-30">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-card border border-border rounded-full px-4 py-2">
            <input
              placeholder="أضف منتجاً..."
              className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItemName.trim()) {
                  const newItem: MarketItem = {
                    id: crypto.randomUUID(),
                    name: newItemName.trim(),
                    category: "أخرى",
                    quantity: "1",
                    addedBy: "أنت",
                    checked: false,
                  };
                  setLists((prev) =>
                    prev.map((list) =>
                      list.id === activeListId
                        ? { ...list, items: [...list.items, newItem], lastUpdatedBy: "أنت", lastUpdatedAt: "الآن" }
                        : list
                    )
                  );
                  setNewItemName("");
                  haptic.medium();
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              haptic.medium();
              setShowAddItem(true);
            }}
            className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4"
            size="sm"
          >
            <Plus size={18} />
            إضافة
        </div>
      </div>

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

      {/* Edit Item Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المنتج</DialogTitle>
            <DialogDescription>عدّل اسم المنتج والكمية والتصنيف</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
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
          <DialogFooter className="flex-row gap-2 pt-2">
            <Button onClick={saveEdit} className="flex-1 rounded-xl">حفظ</Button>
            <Button variant="outline" onClick={() => setEditTarget(null)} className="rounded-xl">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة منتج جديد</DialogTitle>
            <DialogDescription>أضف المنتج مع التصنيف والكمية</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
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
          <DialogFooter className="flex-row gap-2 pt-2">
            <Button onClick={addItem} className="flex-1 rounded-xl">إضافة</Button>
            <Button variant="outline" onClick={() => setShowAddItem(false)} className="rounded-xl">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add List Dialog */}
      <Dialog open={showAddList} onOpenChange={setShowAddList}>
        <DialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء قائمة جديدة</DialogTitle>
            <DialogDescription>أنشئ قائمة تسوق جديدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
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
                      key={member}
                      onClick={() =>
                        setNewListShareMembers((prev) =>
                          prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
                        )
                      }
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
                        newListShareMembers.includes(member)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
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
          <DialogFooter className="flex-row gap-2 pt-2">
            <Button onClick={addList} className="flex-1 rounded-xl">إنشاء</Button>
            <Button variant="outline" onClick={() => setShowAddList(false)} className="rounded-xl">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
          <DialogHeader>
            <DialogTitle>مشاركة القائمة</DialogTitle>
            <DialogDescription>اختر أفراد العائلة لمشاركة هذه القائمة معهم</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
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
          <DialogFooter className="flex-row gap-2 pt-2">
            <Button onClick={shareList} className="flex-1 rounded-xl">مشاركة</Button>
            <Button variant="outline" onClick={() => setShowShareDialog(false)} className="rounded-xl">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Market;
