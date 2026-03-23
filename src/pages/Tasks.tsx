import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useTaskLists } from "@/hooks/useTaskLists";
import { createPortal } from "react-dom";
import { Plus, Search, ListChecks, Check, Users, Lock, Share2, Trash2, Pencil, MoreVertical, Repeat } from "lucide-react";
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

interface TaskItem {
  id: string;
  name: string;
  note: string;
  priority: "none" | "high" | "medium" | "low";
  assignedTo: string;
  done: boolean;
  repeat?: {
    enabled: boolean;
    days: number[]; // 0=Sat..6=Fri
    count: number;
  };
}

const WEEKDAYS_SHORT = [
  { value: 0, label: "سب" },
  { value: 1, label: "أح" },
  { value: 2, label: "إث" },
  { value: 3, label: "ثل" },
  { value: 4, label: "أر" },
  { value: 5, label: "خم" },
  { value: 6, label: "جم" },
];

interface TaskList {
  id: string;
  name: string;
  type: "family" | "personal" | "shared";
  isDefault?: boolean;
  sharedWith?: string[];
  items: TaskItem[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const PRIORITY_INFO: Record<string, { label: string; bg: string; text: string; emoji: string }> = {
  none: { label: "بدون", bg: "bg-muted", text: "text-muted-foreground", emoji: "" },
  high: { label: "عاجل", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", emoji: "🔴" },
  medium: { label: "متوسط", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", emoji: "🟡" },
  low: { label: "عادي", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", emoji: "🟢" },
};

// FAMILY_MEMBERS removed — using useFamilyMembers hook
const SWIPE_WIDTH = 140;

const Tasks = () => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();
  const { members: FAMILY_MEMBERS } = useFamilyMembers();
  const { lists: dbLists, isLoading, createList: createListMutation, deleteList: deleteListMutation, addItem: addItemMutation, updateItem: updateItemMutation, deleteItem: deleteItemMutation } = useTaskLists();

  const lists: TaskList[] = useMemo(() => {
    const mapped = (dbLists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: (l.type || "family") as "family" | "personal" | "shared",
      sharedWith: l.shared_with || [],
      lastUpdatedBy: "",
      lastUpdatedAt: l.updated_at ? new Date(l.updated_at).toLocaleDateString("ar") : "",
      items: (l.task_items || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        note: i.note || "",
        priority: (i.priority || "none") as TaskItem["priority"],
        assignedTo: i.assigned_to || "",
        done: i.done,
        repeat: i.repeat_enabled ? { enabled: true, days: i.repeat_days || [], count: i.repeat_count || 0 } : undefined,
      })),
    }));
    return featureAccess.isStaff ? mapped.filter(l => l.type !== "family") : mapped;
  }, [dbLists, featureAccess.isStaff]);

  const [activeListId, setActiveListId] = useState("");

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
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<string | null>(null);

  // Edit item
  const [editTarget, setEditTarget] = useState<TaskItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState<TaskItem["priority"]>("none");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editRepeatEnabled, setEditRepeatEnabled] = useState(false);
  const [editRepeatDays, setEditRepeatDays] = useState<number[]>([]);
  const [editRepeatCount, setEditRepeatCount] = useState(1);

  // New item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<TaskItem["priority"]>("none");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState("");
  const [newItemRepeatEnabled, setNewItemRepeatEnabled] = useState(false);
  const [newItemRepeatDays, setNewItemRepeatDays] = useState<number[]>([]);
  const [newItemRepeatCount, setNewItemRepeatCount] = useState(1);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"family" | "personal">(featureAccess.isStaff ? "personal" : "family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);

  // Direct long-press drag reorder
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressingRef = useRef(false);
  const pointerStartYRef = useRef(0);
  const itemRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredItems = activeList?.items.filter((item) => {
    return !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
  }) || [];

  const pendingItems = filteredItems.filter((i) => !i.done);
  const doneItems = filteredItems.filter((i) => i.done);

  const totalItems = activeList?.items.length || 0;
  const completedItems = activeList?.items.filter((i) => i.done).length || 0;
  const remainingItems = totalItems - completedItems;

  // Long press starts drag immediately
  const startLongPress = useCallback((id: string, startY: number) => {
    pointerStartYRef.current = startY;
    longPressTimerRef.current = setTimeout(() => {
      haptic.medium();
      isLongPressingRef.current = true;
      setDragActiveId(id);
      // Snapshot all item positions
      itemRectsRef.current.clear();
      itemRefsMap.current.forEach((el, itemId) => {
        itemRectsRef.current.set(itemId, el.getBoundingClientRect());
      });
    }, 400);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const finishDrag = useCallback((targetId: string | null) => {
    if (!dragActiveId || !targetId || dragActiveId === targetId) {
      setDragActiveId(null);
      setDragOverId(null);
      isLongPressingRef.current = false;
      return;
    }
    haptic.light();
    // Drag reorder is local-only for now (no server-side ordering)
    // TODO: implement server-side task ordering
    setDragActiveId(null);
    setDragOverId(null);
    isLongPressingRef.current = false;
  }, [activeListId, dragActiveId]);

  // Swipe handlers
  const closeSwipe = useCallback((id: string) => {
    setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    activeSwipeRef.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    touchStartXRef.current = e.clientX;
    activeSwipeRef.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startLongPress(id, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    // If dragging, find which item we're over
    if (isLongPressingRef.current && dragActiveId) {
      e.preventDefault();
      const y = e.clientY;
      let overItem: string | null = null;
      itemRectsRef.current.forEach((rect, itemId) => {
        if (y >= rect.top && y <= rect.bottom) {
          overItem = itemId;
        }
      });
      if (overItem && overItem !== dragActiveId) {
        setDragOverId(overItem);
      }
      return;
    }

    if (activeSwipeRef.current !== id) return;
    const diffX = e.clientX - touchStartXRef.current;
    const diffY = Math.abs(e.clientY - pointerStartYRef.current);
    // Cancel long press if finger moves horizontally (swipe) or vertically (scroll)
    if (Math.abs(diffX) > 5 || diffY > 5) {
      cancelLongPress();
    }
    setSwipeOffset((prev) => ({ ...prev, [id]: diffX > 0 ? Math.min(diffX, SWIPE_WIDTH) : 0 }));
  };

  const handlePointerUp = (e: React.PointerEvent, id: string) => {
    cancelLongPress();
    if (isLongPressingRef.current) {
      finishDrag(dragOverId);
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
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
    if (item) updateItemMutation.mutate({ id: itemId, done: !item.done });
  }, [activeList, updateItemMutation]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deleteItemMutation.mutate(deleteTarget.id);
    setSwipeOffset((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  }, [deleteTarget, deleteItemMutation]);

  const openEdit = useCallback((item: TaskItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditNote(item.note);
    setEditPriority(item.priority);
    setEditAssignedTo(item.assignedTo);
    setEditRepeatEnabled(item.repeat?.enabled || false);
    setEditRepeatDays(item.repeat?.days || []);
    setEditRepeatCount(item.repeat?.count || 1);
    closeSwipe(item.id);
  }, [closeSwipe]);

  const saveEdit = useCallback(() => {
    if (!editTarget || !editName.trim()) return;
    haptic.medium();
    updateItemMutation.mutate({
      id: editTarget.id,
      name: editName.trim(),
      note: editNote.trim(),
      priority: editPriority,
      assigned_to: editAssignedTo || null,
      repeat_enabled: editRepeatEnabled,
      repeat_days: editRepeatDays,
      repeat_count: editRepeatCount,
    });
    setEditTarget(null);
  }, [editTarget, editName, editNote, editPriority, editAssignedTo, editRepeatEnabled, editRepeatDays, editRepeatCount, updateItemMutation]);

  const addItem = useCallback(() => {
    if (!newItemName.trim() || !activeListId) return;
    haptic.medium();
    addItemMutation.mutate({
      list_id: activeListId,
      name: newItemName.trim(),
      note: newItemNote.trim(),
      priority: newItemPriority,
      assigned_to: newItemAssignedTo || null,
      repeat_enabled: newItemRepeatEnabled,
      repeat_days: newItemRepeatDays,
      repeat_count: newItemRepeatCount,
    });
    setNewItemName("");
    setNewItemNote("");
    setNewItemPriority("medium");
    setNewItemAssignedTo("");
    setNewItemRepeatEnabled(false);
    setNewItemRepeatDays([]);
    setNewItemRepeatCount(1);
    setShowAddItem(false);
  }, [activeListId, newItemName, newItemNote, newItemPriority, newItemAssignedTo, newItemRepeatEnabled, newItemRepeatDays, newItemRepeatCount, addItemMutation]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    createListMutation.mutate({
      name: newListName.trim(),
      type: newListType === "family" && newListShareMembers.length > 0 ? "shared" : newListType,
      shared_with: newListType === "family" ? newListShareMembers : [],
    });
    setNewListName("");
    setNewListShareMembers([]);
    setShowAddList(false);
  }, [newListName, newListType, newListShareMembers, createListMutation]);

  const deleteList = useCallback((listId: string) => {
    haptic.medium();
    deleteListMutation.mutate(listId);
  }, [deleteListMutation]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0) return;
    haptic.medium();
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [selectedShareMembers]);

  const getListIcon = (type: TaskList["type"]) => {
    switch (type) {
      case "family": return <Users size={14} className="text-accent" />;
      case "personal": return <Lock size={14} className="text-accent" />;
      case "shared": return <Share2 size={14} className="text-blue-500" />;
    }
  };

  const renderItem = (item: TaskItem, isDone: boolean) => {
    const prioInfo = PRIORITY_INFO[item.priority];
    const offset = dragActiveId ? 0 : (swipeOffset[item.id] || 0);
    const isDragging = dragActiveId === item.id;
    const isDragOverThis = dragOverId === item.id;

    return (
      <div
        key={item.id}
        ref={(el) => { if (el) itemRefsMap.current.set(item.id, el); }}
        className={`relative overflow-hidden rounded-2xl select-none transition-all duration-200 ${
          isDragging ? "opacity-50 scale-95 shadow-lg ring-2 ring-primary" : ""
        } ${isDragOverThis ? "border-2 border-primary border-dashed" : ""}`}
      >
        {/* Swipe actions behind */}
        {!dragActiveId && (
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
        )}

        {/* Card */}
        <div
          className="relative z-10 bg-card rounded-2xl p-3 flex items-center gap-3 transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
          onPointerDown={(e) => handlePointerDown(e, item.id)}
          onPointerMove={(e) => handlePointerMove(e, item.id)}
          onPointerUp={(e) => handlePointerUp(e, item.id)}
          onPointerCancel={() => { cancelLongPress(); closeSwipe(item.id); setDragActiveId(null); setDragOverId(null); isLongPressingRef.current = false; }}
        >
          <button
            onClick={() => !dragActiveId && toggleItem(item.id)}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isDone
                ? "bg-primary"
                : "border-2 border-border hover:border-primary"
            }`}
          >
            {isDone && <Check size={14} className="text-primary-foreground" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm text-foreground truncate ${isDone ? "line-through" : ""}`}>
              {item.name}
            </p>
            {item.note && (
              <p className="text-[11px] text-muted-foreground truncate">{item.note}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.assignedTo}</p>
          </div>
          {item.priority !== "none" && (
            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioInfo.bg} ${prioInfo.text}`}>
                {prioInfo.emoji} {prioInfo.label}
              </span>
            </div>
          )}
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
          title="المهام"
          actions={[
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
        </PageHeader>

        <PullToRefresh onRefresh={handleRefresh}>
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {activeList.lastUpdatedBy} – {activeList.lastUpdatedAt}
              </span>
              {!activeList.isDefault && (
                <button className="p-1 rounded-lg hover:bg-muted" onClick={() => setShowListActions(true)}>
                  <MoreVertical size={16} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث في المهام..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 bg-card border-border rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="px-4 pt-4 space-y-2 pb-4">
          {pendingItems.map((item) => renderItem(item, false))}

          {doneItems.length > 0 && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">✅ مكتملة</p>
              <div className="space-y-2">
                {doneItems.map((item) => renderItem(item, true))}
              </div>
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ListChecks size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد مهام</p>
            </div>
          )}
        </div>
        </PullToRefresh>

        {/* FAB */}
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
                onClick={() => { setShowListActions(false); if (activeList) setDeleteListTarget(activeList.id); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <Trash2 size={16} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">حذف القائمة</span>
              </button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Delete Task Confirmation */}
        <Drawer open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DrawerContent onClick={(e) => e.stopPropagation()}>
            <DrawerHeader>
              <DrawerTitle className="text-center font-black">حذف المهمة</DrawerTitle>
            </DrawerHeader>
            <div className="px-5 pb-6 space-y-4" dir="rtl">
              <p className="text-center text-sm text-muted-foreground">
                هل أنت متأكد من حذف "{deleteTarget?.name}"؟
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
          <DrawerContent onClick={(e) => e.stopPropagation()}>
            <DrawerHeader>
              <DrawerTitle className="text-center font-black">حذف القائمة</DrawerTitle>
            </DrawerHeader>
            <div className="px-5 pb-6 space-y-4" dir="rtl">
              <p className="text-center text-sm text-muted-foreground">
                هل أنت متأكد من حذف هذه القائمة وجميع مهامها؟
              </p>
              <div className="flex gap-2">
                <button onClick={() => { if (deleteListTarget) deleteList(deleteListTarget); setDeleteListTarget(null); }} className="flex-1 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                  حذف
                </button>
                <button onClick={() => setDeleteListTarget(null)} className="flex-1 py-3 rounded-xl font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Item Drawer */}
        <Drawer open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>تعديل المهمة</DrawerTitle>
              <DrawerDescription>عدّل تفاصيل المهمة</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4">
              <Input placeholder="اسم المهمة" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
              <Input placeholder="ملاحظة (اختياري)" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="rounded-xl" />
              <div>
                <p className="text-xs text-muted-foreground mb-2">الأولوية</p>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setEditPriority(key as TaskItem["priority"])}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        editPriority === key
                          ? "bg-primary text-primary-foreground"
                          : `${info.bg} ${info.text} border border-border`
                      }`}
                    >
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeList?.type !== "personal" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">تكليف إلى</p>
                  <div className="flex flex-wrap gap-2">
                    {FAMILY_MEMBERS.map((member) => (
                      <button
                        key={member.id}                        onClick={() => setEditAssignedTo(member.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          editAssignedTo === member.name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Repeat section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Switch checked={editRepeatEnabled} onCheckedChange={setEditRepeatEnabled} />
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Repeat size={16} className="text-primary" />
                    تكرار المهمة
                  </span>
                </div>
                {editRepeatEnabled && (
                  <>
                    <div className="flex justify-between gap-1.5">
                      {WEEKDAYS_SHORT.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setEditRepeatDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])}
                          className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${
                            editRepeatDays.includes(day.value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 text-right">عدد التكرارات</p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => { if (editRepeatCount > 1) setEditRepeatCount(editRepeatCount - 1); }}
                          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted/80 transition-colors"
                        >−</button>
                        <div className="w-16 h-10 rounded-xl border-2 border-primary bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {editRepeatCount}
                        </div>
                        <button
                          onClick={() => { if (editRepeatCount < 99) setEditRepeatCount(editRepeatCount + 1); }}
                          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted/80 transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </>
                )}
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
              <DrawerTitle>إضافة مهمة جديدة</DrawerTitle>
              <DrawerDescription>أضف مهمة مع الأولوية والتكليف</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4">
              <Input placeholder="اسم المهمة" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="rounded-xl" />
              <Input placeholder="ملاحظة (اختياري)" value={newItemNote} onChange={(e) => setNewItemNote(e.target.value)} className="rounded-xl" />
              <div>
                <p className="text-xs text-muted-foreground mb-2">الأولوية</p>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setNewItemPriority(key as TaskItem["priority"])}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        newItemPriority === key
                          ? "bg-primary text-primary-foreground"
                          : `${info.bg} ${info.text} border border-border`
                      }`}
                    >
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeList?.type !== "personal" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">تكليف إلى</p>
                  <div className="flex flex-wrap gap-2">
                    {FAMILY_MEMBERS.map((member) => (
                      <button
                        key={member.id}                        onClick={() => setNewItemAssignedTo(member.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          newItemAssignedTo === member.name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {member.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Repeat section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-row-reverse">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Repeat size={16} className="text-primary" />
                    تكرار المهمة
                  </span>
                  <Switch checked={newItemRepeatEnabled} onCheckedChange={setNewItemRepeatEnabled} />
                </div>
                {newItemRepeatEnabled && (
                  <>
                    <div className="flex justify-between gap-1.5">
                      {WEEKDAYS_SHORT.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setNewItemRepeatDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])}
                          className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${
                            newItemRepeatDays.includes(day.value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 text-right">عدد التكرارات</p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => { if (newItemRepeatCount > 1) setNewItemRepeatCount(newItemRepeatCount - 1); }}
                          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted/80 transition-colors"
                        >−</button>
                        <div className="w-16 h-10 rounded-xl border-2 border-primary bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {newItemRepeatCount}
                        </div>
                        <button
                          onClick={() => { if (newItemRepeatCount < 99) setNewItemRepeatCount(newItemRepeatCount + 1); }}
                          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted/80 transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </>
                )}
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
              <DrawerTitle>إنشاء قائمة مهام جديدة</DrawerTitle>
              <DrawerDescription>أنشئ قائمة مهام عائلية أو شخصية</DrawerDescription>
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
              {newListType === "family" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">مشاركة مع</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {FAMILY_MEMBERS.map((member) => (
                      <button
                        key={member.id}                        onClick={() =>
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
    </div>
  );
};

export default Tasks;
