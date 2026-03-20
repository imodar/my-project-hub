import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, ListChecks, Check, Users, Lock, Share2, Trash2, Pencil, MoreVertical, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PullToRefresh from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
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

interface TaskItem {
  id: string;
  name: string;
  note: string;
  priority: "none" | "high" | "medium" | "low";
  assignedTo: string;
  done: boolean;
}

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

const FAMILY_MEMBERS = ["أبو فهد", "أم فهد", "فهد", "نورة", "سارة"];
const SWIPE_WIDTH = 140;

const initialLists: TaskList[] = [
  {
    id: "1",
    name: "مهام المنزل",
    type: "family",
    isDefault: true,
    lastUpdatedBy: "أم فهد",
    lastUpdatedAt: "منذ ساعة",
    items: [
      { id: "t1", name: "ترتيب غرفة المعيشة", note: "قبل المغرب", priority: "high", assignedTo: "سارة", done: false },
      { id: "t2", name: "غسل السيارة", note: "يوم السبت", priority: "medium", assignedTo: "فهد", done: false },
      { id: "t3", name: "شراء تمر وحليب", note: "للإفطار", priority: "high", assignedTo: "أم فهد", done: false },
      { id: "t4", name: "إصلاح باب الحديقة", note: "", priority: "low", assignedTo: "أبو فهد", done: true },
    ],
  },
  {
    id: "2",
    name: "مهامي الشخصية",
    type: "personal",
    lastUpdatedBy: "أبو فهد",
    lastUpdatedAt: "أمس",
    items: [
      { id: "t5", name: "مراجعة الطبيب", note: "الأربعاء الساعة 4", priority: "high", assignedTo: "أنت", done: false },
      { id: "t6", name: "تجديد الاستمارة", note: "", priority: "medium", assignedTo: "أنت", done: false },
    ],
  },
];

const Tasks = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<TaskList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(lists[0]?.id || "");
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

  // Edit item
  const [editTarget, setEditTarget] = useState<TaskItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState<TaskItem["priority"]>("medium");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  // New item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<TaskItem["priority"]>("medium");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState("");

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<"family" | "personal">("family");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);

  // Drag reorder state
  const [reorderMode, setReorderMode] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredItems = activeList?.items.filter((item) => {
    return !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
  }) || [];

  const pendingItems = filteredItems.filter((i) => !i.done);
  const doneItems = filteredItems.filter((i) => i.done);

  const totalItems = activeList?.items.length || 0;
  const completedItems = activeList?.items.filter((i) => i.done).length || 0;
  const remainingItems = totalItems - completedItems;

  // Long press to enter reorder mode
  const startLongPress = useCallback((id: string) => {
    longPressTimerRef.current = setTimeout(() => {
      haptic.medium();
      setReorderMode(true);
      setDragItemId(id);
      dragItemRef.current = id;
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleDragOver = useCallback((id: string) => {
    if (!dragItemRef.current || dragItemRef.current === id) return;
    setDragOverItemId(id);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragItemRef.current || dragItemRef.current === targetId) return;
    haptic.light();
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== activeListId) return list;
        const items = [...list.items];
        const fromIdx = items.findIndex((i) => i.id === dragItemRef.current);
        const toIdx = items.findIndex((i) => i.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return list;
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...list, items };
      })
    );
    setDragItemId(null);
    setDragOverItemId(null);
    dragItemRef.current = null;
  }, [activeListId]);

  const exitReorderMode = useCallback(() => {
    setReorderMode(false);
    setDragItemId(null);
    setDragOverItemId(null);
    dragItemRef.current = null;
  }, []);

  // Swipe handlers (disabled during reorder mode)
  const closeSwipe = useCallback((id: string) => {
    setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    activeSwipeRef.current = null;
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (reorderMode) return;
    touchStartXRef.current = e.clientX;
    activeSwipeRef.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (reorderMode) return;
    if (activeSwipeRef.current !== id) return;
    const diff = e.clientX - touchStartXRef.current;
    // Cancel long press if finger moves
    cancelLongPress();
    setSwipeOffset((prev) => ({ ...prev, [id]: diff > 0 ? Math.min(diff, SWIPE_WIDTH) : 0 }));
  };

  const handlePointerUp = (e: React.PointerEvent, id: string) => {
    cancelLongPress();
    if (reorderMode) return;
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
          ? { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item) }
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

  const openEdit = useCallback((item: TaskItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditNote(item.note);
    setEditPriority(item.priority);
    setEditAssignedTo(item.assignedTo);
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
                  ? { ...item, name: editName.trim(), note: editNote.trim(), priority: editPriority, assignedTo: editAssignedTo || item.assignedTo }
                  : item
              ),
            }
          : list
      )
    );
    setEditTarget(null);
  }, [activeListId, editTarget, editName, editNote, editPriority, editAssignedTo]);

  const addItem = useCallback(() => {
    if (!newItemName.trim()) return;
    haptic.medium();
    const newItem: TaskItem = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      note: newItemNote.trim(),
      priority: newItemPriority,
      assignedTo: newItemAssignedTo || "أنت",
      done: false,
    };
    setLists((prev) =>
      prev.map((list) =>
        list.id === activeListId
          ? { ...list, items: [...list.items, newItem], lastUpdatedBy: "أنت", lastUpdatedAt: "الآن" }
          : list
      )
    );
    setNewItemName("");
    setNewItemNote("");
    setNewItemPriority("medium");
    setNewItemAssignedTo("");
    setShowAddItem(false);
  }, [activeListId, newItemName, newItemNote, newItemPriority, newItemAssignedTo]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    const newList: TaskList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      type: newListType === "family" && newListShareMembers.length > 0 ? "shared" : newListType,
      sharedWith: newListType === "family" ? newListShareMembers : undefined,
      lastUpdatedBy: "أنت",
      lastUpdatedAt: "الآن",
      items: [],
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

  const getListIcon = (type: TaskList["type"]) => {
    switch (type) {
      case "family": return <Users size={14} className="text-primary" />;
      case "personal": return <Lock size={14} className="text-accent" />;
      case "shared": return <Share2 size={14} className="text-blue-500" />;
    }
  };

  const renderItem = (item: TaskItem, isDone: boolean) => {
    const prioInfo = PRIORITY_INFO[item.priority];
    const offset = reorderMode ? 0 : (swipeOffset[item.id] || 0);
    const isDragging = dragItemId === item.id;
    const isDragOver = dragOverItemId === item.id;

    return (
      <div
        key={item.id}
        className={`relative overflow-hidden rounded-2xl select-none transition-all duration-200 ${
          isDragging ? "opacity-50 scale-95" : ""
        } ${isDragOver ? "border-2 border-primary border-dashed" : ""}`}
        draggable={reorderMode}
        onDragStart={() => { dragItemRef.current = item.id; setDragItemId(item.id); }}
        onDragOver={(e) => { e.preventDefault(); handleDragOver(item.id); }}
        onDragEnter={(e) => { e.preventDefault(); handleDragOver(item.id); }}
        onDragLeave={() => setDragOverItemId(null)}
        onDrop={(e) => { e.preventDefault(); handleDrop(item.id); }}
        onDragEnd={() => { setDragItemId(null); setDragOverItemId(null); dragItemRef.current = null; }}
      >
        {/* Swipe actions behind */}
        {!reorderMode && (
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
          style={{ transform: `translateX(${offset}px)`, touchAction: reorderMode ? "none" : "pan-y" }}
          onPointerDown={(e) => {
            if (!reorderMode) {
              startLongPress(item.id);
              handlePointerDown(e, item.id);
            }
          }}
          onPointerMove={(e) => {
            if (!reorderMode) {
              handlePointerMove(e, item.id);
            }
          }}
          onPointerUp={(e) => {
            cancelLongPress();
            if (!reorderMode) {
              handlePointerUp(e, item.id);
            }
          }}
          onPointerCancel={() => { cancelLongPress(); closeSwipe(item.id); }}
        >
          {/* Drag handle in reorder mode */}
          {reorderMode && (
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
              <GripVertical size={18} />
            </div>
          )}
          <button
            onClick={() => !reorderMode && toggleItem(item.id)}
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
      <PullToRefresh onRefresh={handleRefresh}>
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
              placeholder="ابحث في المهام..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 bg-card border-border rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Reorder mode banner */}
        {reorderMode && (
          <div className="px-4 py-2 flex items-center justify-between bg-primary/10 border-b border-primary/20">
            <p className="text-xs font-semibold text-primary">🔀 وضع إعادة الترتيب — اسحب العناصر لتغيير ترتيبها</p>
            <Button size="sm" variant="outline" onClick={exitReorderMode} className="text-xs rounded-xl h-7 px-3">
              تم
            </Button>
          </div>
        )}

        {/* Items list */}
        <div className="px-4 pt-4 space-y-2 pb-4">
          {pendingItems.map((item) => renderItem(item, false))}

          {!reorderMode && doneItems.length > 0 && (
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

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المهمة</AlertDialogTitle>
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
                        key={member}
                        onClick={() => setEditAssignedTo(member)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          editAssignedTo === member
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {member}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                        key={member}
                        onClick={() => setNewItemAssignedTo(member)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          newItemAssignedTo === member
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {member}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
    </div>
  );
};

export default Tasks;
