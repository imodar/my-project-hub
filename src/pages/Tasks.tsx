import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useTaskLists } from "@/hooks/useTaskLists";
import { useTrash } from "@/contexts/TrashContext";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { useAuth } from "@/contexts/AuthContext";
import FAB from "@/components/FAB";
import { Plus, Search, ListChecks, Check, Users, Lock, Share2, Trash2, Pencil, MoreVertical, UserCheck, GripVertical } from "lucide-react";
import SwipeableCard from "@/components/SwipeableCard";
import PullToRefresh from "@/components/PullToRefresh";
import { useFamilyId } from "@/hooks/useFamilyId";
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
  addedBy: string;
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

// FAMILY_MEMBERS removed — using useFamilyMembers hook
// SWIPE_WIDTH removed — using shared SwipeableCard
const DEFAULT_FAMILY_LIST_NAME = "مهام العائلة";

const Tasks = () => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();
  const { user } = useAuth();
  const { members: rawMembers } = useFamilyMembers();
  const FAMILY_MEMBERS = useMemo(() => {
    if (!user?.id) return rawMembers;
    return [...rawMembers].sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  }, [rawMembers, user?.id]);
  const { familyId } = useFamilyId();
  const { lists: dbLists, isLoading, isSyncing, createList: createListMutation, deleteList: deleteListMutation, addItem: addItemMutation, toggleItem: toggleItemMutation, updateItem: updateItemMutation, deleteItem: deleteItemMutation, updateList: updateListMutation, pendingItemIds } = useTaskLists();
  const { addToTrash } = useTrash();
  const createdDefaultListRef = useRef<string | null>(null);

  const lists: TaskList[] = useMemo(() => {
    const mapped = (dbLists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: (l.type || "family") as "family" | "personal" | "shared",
      isDefault: !!l.is_default,
      sharedWith: l.shared_with || [],
      lastUpdatedBy: "",
      lastUpdatedAt: l.updated_at ? new Date(l.updated_at).toLocaleDateString("ar") : "",
      items: (l.task_items || [])
        .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          note: i.note || "",
          priority: (i.priority || "none") as TaskItem["priority"],
          assignedTo: i.assigned_to || "",
          addedBy: i.added_by ? (FAMILY_MEMBERS.find(m => m.id === i.added_by)?.name || "") : "",
          done: i.done,
        })),
    }));
    // Sort by created_at ascending (oldest first, same as Market)
    mapped.sort((a, b) => {
      const da = (dbLists || []).find((l: any) => l.id === a.id)?.created_at || "";
      const db2 = (dbLists || []).find((l: any) => l.id === b.id)?.created_at || "";
      return da.localeCompare(db2);
    });
    return featureAccess.isStaff ? mapped.filter(l => l.type !== "family") : mapped;
  }, [dbLists, featureAccess.isStaff, FAMILY_MEMBERS]);

  // Auto-create default family list
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
    ) return;
    createListMutation.mutate(
      {
        name: DEFAULT_FAMILY_LIST_NAME,
        type: "family",
        shared_with: [],
      },
      {
        onSuccess: () => { createdDefaultListRef.current = familyId; },
        onError: () => { createdDefaultListRef.current = null; },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, featureAccess.isStaff, isLoading, isSyncing, dbLists]);

  const [activeListId, setActiveListId] = useState("");
  const pendingActiveListIdRef = useRef<string | null>(null);

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
  const [taskTab, setTaskTab] = useState<"all" | "mine">("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<string | null>(null);

  // Edit item
  const [editTarget, setEditTarget] = useState<TaskItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState<TaskItem["priority"]>("none");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  // New item form
  const [newItemName, setNewItemName] = useState("");
  const newItemNameRef = useRef("");
  const [newItemNote, setNewItemNote] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<TaskItem["priority"]>("none");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState("");

  // Draft persistence للنموذج
  const taskDraft = useDraftPersistence<{
    name: string; note: string;
    priority: TaskItem["priority"]; assignedTo: string;
  }>(`task-add-${activeListId}`);

  // Pagination
  const PAGE_SIZE = 30;
  const [visiblePendingCount, setVisiblePendingCount] = useState(PAGE_SIZE);
  const [visibleDoneCount, setVisibleDoneCount] = useState(PAGE_SIZE);

  // New list form
  const [newListName, setNewListName] = useState("");
  const newListNameRef = useRef("");
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

  // إعادة تعيين الصفحات عند تغيير القائمة أو البحث
  useEffect(() => {
    setVisiblePendingCount(PAGE_SIZE);
    setVisibleDoneCount(PAGE_SIZE);
  }, [activeListId, searchQuery]);

  const isSharedList = activeList && (activeList.type === "shared" || activeList.type === "family");
  const filteredItems = activeList?.items.filter((item) => {
    const matchesSearch = !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
    const matchesTab = !isSharedList || taskTab === "all" || item.assignedTo === user?.id;
    return matchesSearch && matchesTab;
  }) || [];

  const pendingItems = filteredItems.filter((i) => !i.done);
  const doneItems = filteredItems.filter((i) => i.done);

  const visiblePendingItems = pendingItems.slice(0, visiblePendingCount);
  const visibleDoneItems = doneItems.slice(0, visibleDoneCount);

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

  // Swipe handlers moved to SwipeableCard component
  // Long-press drag handlers for reorder
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    startLongPress(id, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
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
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cancelLongPress();
    if (isLongPressingRef.current) {
      finishDrag(dragOverId);
    }
  };

  const toggleItem = useCallback((itemId: string) => {
    haptic.light();
    const item = activeList?.items.find(i => i.id === itemId);
    if (item) toggleItemMutation.mutate({ id: itemId, done: !item.done });
  }, [activeList, toggleItemMutation]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deleteItemMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteItemMutation]);

  const openEdit = useCallback((item: TaskItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditNote(item.note);
    setEditPriority(item.priority);
    setEditAssignedTo(item.assignedTo);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editTarget || !editName.trim()) return;
    haptic.medium();
    updateItemMutation.mutate({
      id: editTarget.id,
      name: editName.trim(),
      note: editNote.trim(),
      priority: editPriority,
      assigned_to: editAssignedTo || null,
    });
    setEditTarget(null);
  }, [editTarget, editName, editNote, editPriority, editAssignedTo, updateItemMutation]);

  const addItem = useCallback(() => {
    const name = (newItemNameRef.current || newItemName).trim();
    if (!name || !activeListId) return;
    haptic.medium();
    addItemMutation.mutate({
      list_id: activeListId,
      name,
      note: newItemNote.trim(),
      priority: newItemPriority,
      assigned_to: newItemAssignedTo || null,
    });
    newItemNameRef.current = "";
    setNewItemName("");
    setNewItemNote("");
    setNewItemPriority("none");
    setNewItemAssignedTo("");
    setShowAddItem(false);
  }, [activeListId, newItemName, newItemNote, newItemPriority, newItemAssignedTo, addItemMutation]);

  const addList = useCallback(() => {
    const name = (newListNameRef.current || newListName).trim();
    if (!name) return;
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
    setShowAddList(false);
  }, [newListName, newListShareMembers, createListMutation]);


  const deleteList = useCallback((listId: string) => {
    haptic.medium();

    // Save to trash with full data
    const listToDelete = dbLists.find((l: any) => l.id === listId);
    if (listToDelete) {
      addToTrash({
        type: "task_list",
        title: listToDelete.name,
        description: `${(listToDelete as any).task_items?.length || 0} مهمة`,
        deletedBy: "",
        isShared: listToDelete.type === "family",
        originalData: {
          id: listToDelete.id,
          name: listToDelete.name,
          type: listToDelete.type,
          family_id: listToDelete.family_id,
          created_by: listToDelete.created_by,
          shared_with: listToDelete.shared_with,
        },
        relatedRecords: (listToDelete as any).task_items || [],
      });
    }

    deleteListMutation.mutate(listId);
  }, [deleteListMutation, dbLists, addToTrash]);

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

  const getListIcon = (type: TaskList["type"], isActive: boolean) => {
    switch (type) {
      case "family": return <Users size={14} className={isActive ? "text-primary" : "text-white/90"} />;
      case "personal": return <Lock size={14} className={isActive ? "text-accent" : "text-white/90"} />;
      case "shared": return <Share2 size={14} className={isActive ? "text-blue-500" : "text-white/90"} />;
    }
  };

  const renderItem = (item: TaskItem, isDone: boolean) => {
    const prioInfo = PRIORITY_INFO[item.priority];
    const isDraggingItem = dragActiveId === item.id;
    const isDragOverThis = dragOverId === item.id;

    return (
      <div
        key={item.id}
        ref={(el) => { if (el) itemRefsMap.current.set(item.id, el); }}
        className={`select-none transition-all duration-200 ${
          isDraggingItem ? "opacity-50 scale-95 shadow-lg ring-2 ring-primary" : ""
        } ${isDragOverThis ? "border-2 border-primary border-dashed rounded-2xl" : ""}`}
      >
        <SwipeableCard
          onSwipeOpen={() => setOpenCardId(item.id)}
          actions={[
            { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => openEdit(item) },
            { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => setDeleteTarget(item) },
          ]}
        >
          <div
            className={`rounded-2xl p-3 flex items-center gap-3 transition-colors border ${isDone ? "bg-muted border-dashed border-border" : "bg-white border-border/60"}`}
            style={{ touchAction: "pan-y" }}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            onPointerMove={(e) => handlePointerMove(e)}
            onPointerUp={(e) => handlePointerUp(e)}
            onPointerCancel={() => { cancelLongPress(); setDragActiveId(null); setDragOverId(null); isLongPressingRef.current = false; }}
          >
            <div className="relative shrink-0 w-7 h-7">
              {pendingItemIds.includes(item.id) && (
                <div className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-primary animate-spin" />
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => !dragActiveId && toggleItem(item.id)}
                role="checkbox"
                aria-checked={isDone}
                aria-label={`تحديد ${item.name}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-primary"
                    : "bg-card border-2 border-border hover:border-primary"
                }`}
              >
                {isDone && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-base text-foreground break-words overflow-hidden ${isDone ? "line-through" : ""}`} style={{ overflowWrap: "anywhere" }}>
                {item.name}
              </p>
              {item.note && (
                <p className="text-xs text-muted-foreground truncate">{item.note}</p>
              )}
              {item.addedBy && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.addedBy}</p>
              )}
            </div>
            {(item.priority !== "none" || item.assignedTo) && (
              <div className="flex flex-col items-end gap-1">
                {item.priority !== "none" && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioInfo.bg} ${prioInfo.text}`}>
                    {prioInfo.emoji} {prioInfo.label}
                  </span>
                )}
                {item.assignedTo && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
                    <UserCheck size={9} />
                    {FAMILY_MEMBERS.find(m => m.id === item.assignedTo)?.name ?? ""}
                  </span>
                )}
              </div>
            )}
            <div className="shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing" aria-label="سحب لإعادة الترتيب">
              <GripVertical size={18} />
            </div>
          </div>
        </SwipeableCard>
      </div>
    );
  };

  const tasksQueryClient = useQueryClient();
  const handleRefresh = async () => {
    await tasksQueryClient.invalidateQueries({ queryKey: ["task-lists"] });
  };

  return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
        <PageHeader
          title="المهام"
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
          {/* Lists tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-3 scrollbar-hide">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => {
                  haptic.light();
                  setActiveListId(list.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold max-w-[140px] transition-all ${
                  activeListId === list.id
                    ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-md"
                    : "bg-white/15 text-white/80 hover:bg-white/25"
                }`}
              >
                <span className="shrink-0">{getListIcon(list.type, activeListId === list.id)}</span>
                <span className="truncate">{list.name}</span>
              </button>
            ))}
          </div>
        </PageHeader>

        <PullToRefresh onRefresh={handleRefresh}>
        {/* Search */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${showSearch ? "max-h-16 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={(el) => { if (el && showSearch) el.focus(); }}
                placeholder="ابحث في المهام..."
                aria-label="بحث في المهام"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => { setShowSearch(false); setSearchQuery(""); }}
                className="pr-9 bg-card border-border rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        {activeList && (
          <div className="px-4 pt-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {remainingItems} متبقي
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {completedItems} مكتمل
              </span>
            </div>
          </div>
        )}

        {/* Shared/Assigned tabs */}
        {isSharedList && (
          <div className="px-4 pt-2 flex gap-2">
            <button
              onClick={() => setTaskTab("all")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${taskTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              مهام مشتركة
            </button>
            <button
              onClick={() => setTaskTab("mine")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${taskTab === "mine" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              مهام مسندة إلي
            </button>
          </div>
        )}

        {/* Items list */}
        <div className="px-4 pt-4 space-y-2 pb-4">
          {visiblePendingItems.map((item) => renderItem(item, false))}

          {pendingItems.length > visiblePendingCount && (
            <button
              onClick={() => setVisiblePendingCount((n) => n + PAGE_SIZE)}
              className="w-full py-2.5 text-xs text-primary font-semibold rounded-xl border border-primary/30 hover:bg-primary/5 transition-colors"
            >
              تحميل {Math.min(PAGE_SIZE, pendingItems.length - visiblePendingCount)} مهمة إضافية
            </button>
          )}

          {doneItems.length > 0 && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">✅ مكتملة</p>
              <div className="space-y-2">
                {visibleDoneItems.map((item) => renderItem(item, true))}
              </div>
              {doneItems.length > visibleDoneCount && (
                <button
                  onClick={() => setVisibleDoneCount((n) => n + PAGE_SIZE)}
                  className="w-full mt-2 py-2 text-xs text-muted-foreground font-medium rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  تحميل {Math.min(PAGE_SIZE, doneItems.length - visibleDoneCount)} مكتملة إضافية
                </button>
              )}
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted/50 rounded-full p-4 mb-4">
                <ListChecks className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">لا توجد مهام</p>
              <p className="text-xs text-muted-foreground/70 mt-1">أضف مهمة جديدة من زر +</p>
            </div>
          )}
        </div>
        </PullToRefresh>

        <FAB onClick={() => {
          haptic.medium();
          // تحميل المسودة إن وجدت
          const draft = taskDraft.loadDraft();
          setNewItemName(draft?.name ?? "");
          setNewItemNote(draft?.note ?? "");
          setNewItemPriority(draft?.priority ?? "none");
          setNewItemAssignedTo(draft?.assignedTo ?? "");
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
            <DrawerHeader className="text-right pb-1">
              <DrawerTitle className="text-lg">تعديل المهمة</DrawerTitle>
              <DrawerDescription className="text-xs">حدّد الأولوية واسم المهمة والمسؤول</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto space-y-5 px-4 pb-3">
              {/* Priority grid — same spirit as Market category grid */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-sm font-bold text-foreground">الأولوية</p>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                    {PRIORITY_INFO[editPriority]?.emoji || "⚪️"} {PRIORITY_INFO[editPriority]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {Object.entries(PRIORITY_INFO).map(([key, info]) => {
                    const isActive = editPriority === key;
                    const emoji = info.emoji || "⚪️";
                    return (
                      <button
                        key={key}
                        onClick={() => setEditPriority(key as TaskItem["priority"])}
                        className={`group relative flex flex-col items-center gap-1.5 py-2 transition-all duration-300 ${
                          isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div
                          className={`relative w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl transition-all duration-300 ${
                            isActive
                              ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg"
                              : "ring-0"
                          }`}
                        >
                          {emoji}
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                              <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center transition-all ${
                          isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        }`}>
                          {info.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Underline-only task name input */}
              <div className="space-y-2 px-1">
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">المهمة</label>
                  <Input
                    placeholder="مثال: شراء الخبز"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Members — beautiful avatar list */}
              {activeList?.type !== "personal" && FAMILY_MEMBERS.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-bold text-foreground">تكليف إلى</p>
                    {editAssignedTo && (
                      <button
                        onClick={() => setEditAssignedTo("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {FAMILY_MEMBERS.map((member) => {
                      const isActive = editAssignedTo === member.id;
                      const initial = (member.name || "?").trim().charAt(0);
                      return (
                        <button
                          key={member.id}
                          onClick={() => setEditAssignedTo(isActive ? "" : member.id)}
                          className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300 ${
                            isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div
                            className={`relative w-14 h-14 rounded-full flex items-center justify-center text-lg font-black bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 ${
                              isActive
                                ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg"
                                : "ring-0"
                            }`}
                          >
                            {initial}
                            {isActive && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                                <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight text-center max-w-[60px] truncate ${
                            isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                          }`}>
                            {member.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row gap-2 pt-3">
              <Button onClick={saveEdit} className="flex-[2] rounded-2xl h-12 font-bold text-base shadow-md">
                <Check size={18} className="ml-1" />
                حفظ التعديلات
              </Button>
              <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1 rounded-2xl h-12">إلغاء</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Add Item Drawer */}
        <Drawer open={showAddItem} onOpenChange={(open) => {
          if (!open) taskDraft.clearDraft();
          setShowAddItem(open);
        }}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right pb-1">
              <DrawerTitle className="text-lg">إضافة مهمة جديدة</DrawerTitle>
              <DrawerDescription className="text-xs">حدّد الأولوية واكتب اسم المهمة واختر المسؤول</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto space-y-5 px-4 pb-3">
              {/* Priority grid first */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-sm font-bold text-foreground">الأولوية</p>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                    {PRIORITY_INFO[newItemPriority]?.emoji || "⚪️"} {PRIORITY_INFO[newItemPriority]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {Object.entries(PRIORITY_INFO).map(([key, info]) => {
                    const isActive = newItemPriority === key;
                    const emoji = info.emoji || "⚪️";
                    return (
                      <button
                        key={key}
                        onClick={() => { setNewItemPriority(key as TaskItem["priority"]); taskDraft.saveDraft({ name: newItemName, note: "", priority: key as TaskItem["priority"], assignedTo: newItemAssignedTo }); }}
                        className={`group relative flex flex-col items-center gap-1.5 py-2 transition-all duration-300 ${
                          isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div
                          className={`relative w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl transition-all duration-300 ${
                            isActive
                              ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg"
                              : "ring-0"
                          }`}
                        >
                          {emoji}
                          {isActive && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                              <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center transition-all ${
                          isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        }`}>
                          {info.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Underline-only task name input */}
              <div className="space-y-2 px-1">
                <div className="relative">
                  <label className="absolute right-0 top-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">المهمة</label>
                  <Input
                    placeholder="مثال: شراء الخبز"
                    value={newItemName}
                    onChange={(e) => { newItemNameRef.current = e.target.value; setNewItemName(e.target.value); taskDraft.saveDraft({ name: e.target.value, note: "", priority: newItemPriority, assignedTo: newItemAssignedTo }); }}
                    onInput={(e) => { newItemNameRef.current = (e.target as HTMLInputElement).value; }}
                    className="h-[60px] border-0 border-b-2 border-border rounded-none bg-transparent text-lg font-bold pt-7 pb-2 px-0 outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Members — beautiful avatar list */}
              {activeList?.type !== "personal" && FAMILY_MEMBERS.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-bold text-foreground">تكليف إلى</p>
                    {newItemAssignedTo && (
                      <button
                        onClick={() => { setNewItemAssignedTo(""); taskDraft.saveDraft({ name: newItemName, note: "", priority: newItemPriority, assignedTo: "" }); }}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {FAMILY_MEMBERS.map((member) => {
                      const isActive = newItemAssignedTo === member.id;
                      const initial = (member.name || "?").trim().charAt(0);
                      return (
                        <button
                          key={member.id}
                          onClick={() => { const next = isActive ? "" : member.id; setNewItemAssignedTo(next); taskDraft.saveDraft({ name: newItemName, note: "", priority: newItemPriority, assignedTo: next }); }}
                          className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300 ${
                            isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div
                            className={`relative w-14 h-14 rounded-full flex items-center justify-center text-lg font-black bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 ${
                              isActive
                                ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg"
                                : "ring-0"
                            }`}
                          >
                            {initial}
                            {isActive && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                                <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight text-center max-w-[60px] truncate ${
                            isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                          }`}>
                            {member.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row gap-2 pt-3">
              <Button onClick={() => { taskDraft.clearDraft(); addItem(); }} className="flex-[2] rounded-2xl h-12 font-bold text-base shadow-md">
                <Plus size={18} className="ml-1" />
                إضافة المهمة
              </Button>
              <Button variant="outline" onClick={() => { taskDraft.clearDraft(); setShowAddItem(false); }} className="flex-1 rounded-2xl h-12">إلغاء</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Add List Drawer */}
        <Drawer open={showAddList} onOpenChange={setShowAddList}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>إنشاء قائمة مهام جديدة</DrawerTitle>
              <DrawerDescription>أنشئ قائمة مهام جديدة</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4">
              <Input placeholder="اسم القائمة" value={newListName}
                onChange={(e) => { newListNameRef.current = e.target.value; setNewListName(e.target.value); }}
                onInput={(e) => { newListNameRef.current = (e.target as HTMLInputElement).value; }}
                className="rounded-xl" />
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
