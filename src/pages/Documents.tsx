import { useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ListContentSkeleton } from "@/components/PageSkeletons";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useDocumentLists } from "@/hooks/useDocumentLists";
import FAB from "@/components/FAB";
import SwipeableCard from "@/components/SwipeableCard";
import {
  Plus, Search, FolderLock, Users, Lock, Share2, Trash2, Pencil,
  MoreVertical, Check, FileText, Image, File, Bell, Calendar,
  CreditCard, Heart, Car, Home, MoreHorizontal, Eye, Download,
  ChevronDown, ChevronUp, BookOpen, ExternalLink, X, Loader2, Upload
} from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useUserRole } from "@/contexts/UserRoleContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";

type DocCategory = "identity" | "medical" | "vehicles" | "home" | "passport" | "other";

interface DocFile {
  id: string;
  name: string;
  type: "image" | "pdf";
  url: string;
  size: string;
  rawSize?: number;
  addedAt: string;
}

interface DocumentItem {
  id: string;
  name: string;
  category: DocCategory;
  files: DocFile[];
  expiryDate?: string;
  reminderEnabled: boolean;
  note: string;
  addedBy: string;
  addedAt: string;
}

interface DocList {
  id: string;
  name: string;
  type: "family" | "personal" | "shared";
  isDefault?: boolean;
  sharedWith?: string[];
  items: DocumentItem[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const CATEGORIES: Record<DocCategory, { label: string; icon: typeof CreditCard; bg: string; color: string }> = {
  identity: { label: "هوية", icon: CreditCard, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-300" },
  medical: { label: "طبي", icon: Heart, bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600 dark:text-red-300" },
  vehicles: { label: "مركبات", icon: Car, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-300" },
  home: { label: "منزل", icon: Home, bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-300" },
  passport: { label: "جوازات سفر", icon: BookOpen, bg: "bg-indigo-100 dark:bg-indigo-900/30", color: "text-indigo-600 dark:text-indigo-300" },
  other: { label: "أخرى", icon: File, bg: "bg-muted", color: "text-muted-foreground" },
};

const SWIPE_WIDTH = 140;

/* ── Upload Overlay state ── */
interface UploadOverlayState {
  file: File;
  progress: number;
  phase: "uploading" | "form";
  previewUrl: string | null;
  storagePath: string;
  signedUrl: string;
  fileType: "image" | "pdf";
  /** If set, attach file to this existing document instead of creating a new one */
  attachToDocumentId?: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const { featureAccess } = useUserRole();
  const { members: FAMILY_MEMBERS } = useFamilyMembers();
  const {
    lists: dbDocLists,
    isLoading: docsLoading,
    createList: createDocListMut,
    deleteList: deleteDocListMut,
    addItem: addDocItemMut,
    addFile: addDocFileMut,
    updateItem: updateDocItemMut,
    deleteItem: deleteDocItemMut,
    updateList: updateDocListMut,
  } = useDocumentLists();
  const { familyId } = useFamilyId();

  const lists: DocList[] = useMemo(() => {
    const mapped = (dbDocLists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type || "family",
      isDefault: !!l.is_default,
      sharedWith: l.shared_with || [],
      lastUpdatedBy: "",
      lastUpdatedAt: "",
      items: (l.document_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: (item.category || "other") as DocCategory,
        files: (item.document_files || []).map((f: any) => ({
          id: f.id, name: f.name, type: f.type || "pdf", url: f.file_url || "", size: f.size?.toString() || "0", addedAt: f.added_at,
        })),
        expiryDate: item.expiry_date,
        reminderEnabled: item.reminder_enabled || false,
        note: item.note || "",
        addedBy: item.added_by || "",
        addedAt: item.added_at,
      })),
    }));
    return featureAccess.isStaff ? mapped.filter((l: DocList) => l.type !== "family") : mapped;
  }, [dbDocLists, featureAccess.isStaff]);

  const [activeListId, setActiveListId] = useState(lists[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<DocCategory | "all">("all");
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null);

  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  // Edit item
  const [editTarget, setEditTarget] = useState<DocumentItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<DocCategory>("identity");
  const [editNote, setEditNote] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);

  // Upload overlay
  const [uploadOverlay, setUploadOverlay] = useState<UploadOverlayState | null>(null);
  const [overlayName, setOverlayName] = useState("");
  const [overlayCategory, setOverlayCategory] = useState<DocCategory>("identity");
  const [overlayNote, setOverlayNote] = useState("");
  const [overlayExpiryDate, setOverlayExpiryDate] = useState("");
  const [overlayReminderEnabled, setOverlayReminderEnabled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState(false);

  // Track what mode the file picker was opened for
  const pickerModeRef = useRef<"new" | "attach">("new");
  const attachTargetRef = useRef<string | null>(null);

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredItems = activeList?.items.filter((item) => {
    const matchesSearch = !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const totalItems = activeList?.items.length || 0;

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "منتهي", className: "bg-destructive/10 text-destructive" };
    if (diffDays <= 60) return { label: `${diffDays} يوم`, className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" };
    return { label: `${diffDays} يوم`, className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" };
  };

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    haptic.medium();
    deleteDocItemMut.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteDocItemMut]);

  const openEdit = useCallback((item: DocumentItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditNote(item.note);
    setEditExpiryDate(item.expiryDate || "");
    setEditReminderEnabled(item.reminderEnabled);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editTarget || !editName.trim()) return;
    haptic.medium();
    updateDocItemMut.mutate({
      id: editTarget.id,
      name: editName.trim(), category: editCategory, note: editNote.trim(),
      expiry_date: editExpiryDate || null, reminder_enabled: editReminderEnabled,
    });
    setEditTarget(null);
  }, [editTarget, editName, editCategory, editNote, editExpiryDate, editReminderEnabled, updateDocItemMut]);

  /* ── File picker trigger ── */
  const openFilePicker = useCallback((mode: "new" | "attach", documentId?: string) => {
    pickerModeRef.current = mode;
    attachTargetRef.current = documentId || null;
    // Close any open edit sheet first so it doesn't interfere
    if (mode === "attach") {
      setEditTarget(null);
    }
    // Small delay to let sheet close animation finish
    setTimeout(() => {
      fileInputRef.current?.click();
    }, mode === "attach" ? 350 : 0);
  }, []);

  /* ── Handle file selection → upload → show overlay ── */
  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // reset after capturing the File object so Android doesn't clear it before we use it

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      appToast.error("نوع الملف غير مدعوم، يُسمح بالصور وPDF فقط");
      return;
    }

    if (!familyId) {
      appToast.error("لا يمكن رفع الملف بدون عائلة");
      return;
    }

    // Create preview for images
    let previewUrl: string | null = null;
    if (isImage) {
      previewUrl = URL.createObjectURL(file);
    }

    const fileId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${familyId}/${fileId}.${ext}`;

    // Show overlay immediately with uploading state
    setUploadOverlay({
      file,
      progress: 0,
      phase: "uploading",
      previewUrl,
      storagePath,
      signedUrl: "",
      fileType: isImage ? "image" : "pdf",
      attachToDocumentId: pickerModeRef.current === "attach" ? (attachTargetRef.current || undefined) : undefined,
    });

    // Reset form fields
    setOverlayName(file.name.replace(/\.[^.]+$/, ""));
    setOverlayCategory("identity");
    setOverlayNote("");
    setOverlayExpiryDate("");
    setOverlayReminderEnabled(false);

    try {
      // Simulate progress (Supabase JS SDK doesn't support progress callbacks)
      const progressInterval = setInterval(() => {
        setUploadOverlay(prev => {
          if (!prev || prev.phase !== "uploading") return prev;
          const next = Math.min(prev.progress + 15, 90);
          return { ...prev, progress: next };
        });
      }, 300);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      clearInterval(progressInterval);

      if (uploadError) {
        console.error("[Documents] Upload failed:", uploadError);
        appToast.error("فشل رفع الملف إلى التخزين السحابي");
        setUploadOverlay(null);
        return;
      }

      // Cache locally for offline
      try {
        if ("caches" in window) {
          const cache = await caches.open("documents-cache-v1");
          await cache.put(storagePath, new Response(file));
        }
      } catch {}

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      const signedUrl = signedData?.signedUrl || storagePath;

      // Move to form phase
      setUploadOverlay(prev => prev ? {
        ...prev,
        progress: 100,
        phase: "form",
        signedUrl,
      } : null);

    } catch (err) {
      console.error("[Documents] Upload error:", err);
      appToast.error("حدث خطأ أثناء رفع الملف");
      setUploadOverlay(null);
    }
  }, [familyId]);

  /* ── Confirm: save file to DB ── */
  const confirmUpload = useCallback(async () => {
    if (!uploadOverlay) return;

    // If attaching to an existing document, no list needed
    if (!uploadOverlay.attachToDocumentId && !activeListId) {
      appToast.error("أنشئ قائمة وثائق أولاً ثم أضف المستند");
      return;
    }
    haptic.medium();

    const sizeLabel = uploadOverlay.file.size < 1024 * 1024
      ? `${(uploadOverlay.file.size / 1024).toFixed(0)} KB`
      : `${(uploadOverlay.file.size / (1024 * 1024)).toFixed(1)} MB`;

    if (uploadOverlay.attachToDocumentId) {
      // Attach to existing document
      addDocFileMut.mutate({
        document_id: uploadOverlay.attachToDocumentId,
        name: uploadOverlay.file.name,
        file_url: uploadOverlay.signedUrl,
        type: uploadOverlay.fileType,
        size: uploadOverlay.file.size,
      });
      appToast.success("تم إرفاق الملف بنجاح");
      setUploadOverlay(null);
      return;
    }

    // Create new document with file
    try {
      const result = await addDocItemMut.mutateAsync({
        list_id: activeListId,
        name: overlayName.trim() || uploadOverlay.file.name,
        category: overlayCategory,
        note: overlayNote.trim(),
        expiry_date: overlayExpiryDate || undefined,
        reminder_enabled: overlayReminderEnabled,
      });

      const documentId = (result as any)?.data?.id;
      if (documentId) {
        addDocFileMut.mutate({
          document_id: documentId,
          name: uploadOverlay.file.name,
          file_url: uploadOverlay.signedUrl,
          type: uploadOverlay.fileType,
          size: uploadOverlay.file.size,
        });
      }

      appToast.success("تم إضافة المستند بنجاح");
    } catch (err) {
      console.error("[Documents] Failed to add document:", err);
      appToast.error("فشل في إضافة المستند");
    }

    setUploadOverlay(null);
  }, [uploadOverlay, activeListId, overlayName, overlayCategory, overlayNote, overlayExpiryDate, overlayReminderEnabled, addDocItemMut, addDocFileMut]);

  /* ── Cancel: delete uploaded file from storage ── */
  const cancelUpload = useCallback(async () => {
    if (!uploadOverlay) return;
    try {
      await supabase.storage.from("documents").remove([uploadOverlay.storagePath]);
      // Also remove from cache
      if ("caches" in window) {
        const cache = await caches.open("documents-cache-v1");
        await cache.delete(uploadOverlay.storagePath);
      }
    } catch {}
    if (uploadOverlay.previewUrl) {
      URL.revokeObjectURL(uploadOverlay.previewUrl);
    }
    setUploadOverlay(null);
  }, [uploadOverlay]);

  const addList = useCallback(() => {
    if (!newListName.trim()) return;
    haptic.medium();
    const autoType = newListShareMembers.length > 0 ? "family" : "personal";
    createDocListMut.mutate({ name: newListName.trim(), type: autoType, shared_with: newListShareMembers });
    setNewListName(""); setNewListShareMembers([]); setShowAddList(false);
  }, [newListName, newListShareMembers, createDocListMut]);

  const deleteList = useCallback((listId: string) => {
    haptic.medium();
    deleteDocListMut.mutate(listId);
    if (activeListId === listId && lists.length > 1) {
      const remaining = lists.filter(l => l.id !== listId);
      if (remaining.length > 0) setActiveListId(remaining[0].id);
    }
  }, [activeListId, lists, deleteDocListMut]);

  const shareList = useCallback(() => {
    if (selectedShareMembers.length === 0 || !activeListId) return;
    haptic.medium();
    updateDocListMut.mutate({
      id: activeListId,
      shared_with: selectedShareMembers,
      type: "shared",
    });
    setSelectedShareMembers([]);
    setShowShareDialog(false);
  }, [activeListId, selectedShareMembers, updateDocListMut]);

  const getListIcon = (type: DocList["type"], isActive: boolean) => {
    switch (type) {
      case "family": return <Users size={14} className={isActive ? "text-primary" : "text-white/90"} />;
      case "personal": return <Lock size={14} className={isActive ? "text-accent" : "text-white/90"} />;
      case "shared": return <Share2 size={14} className={isActive ? "text-blue-500" : "text-white/90"} />;
    }
  };

  const renderItem = (item: DocumentItem) => {
    const catInfo = CATEGORIES[item.category];
    const CatIcon = catInfo.icon;
    const expiryStatus = getExpiryStatus(item.expiryDate);

    return (
      <SwipeableCard
        key={item.id}
        onSwipeOpen={() => setOpenCardId(item.id)}
        actions={[
          { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => setDeleteTarget(item) },
          { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => openEdit(item) },
        ]}
      >
        <div
          className="bg-card rounded-2xl p-3 flex items-center gap-3"
          onClick={() => setViewDoc(item)}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catInfo.bg}`}>
            <CatIcon size={20} className={catInfo.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
            {item.note && (
              <p className="text-[11px] text-muted-foreground truncate">{item.note}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catInfo.bg} ${catInfo.color}`}>
                {catInfo.label}
              </span>
              {item.files.length > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <FileText size={10} /> {item.files.length}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {expiryStatus && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${expiryStatus.className}`}>
                {expiryStatus.label}
              </span>
            )}
            {item.reminderEnabled && item.expiryDate && (
              <Bell size={12} className="text-amber-500" />
            )}
          </div>
        </div>
      </SwipeableCard>
    );
  };

  const docsQueryClient = useQueryClient();
  const handleRefresh = async () => {
    await docsQueryClient.invalidateQueries({ queryKey: ["document-lists"] });
  };

  const renderCategoryForm = (
    category: DocCategory,
    setCategory: (c: DocCategory) => void
  ) => (
    <div>
      <p className="text-xs text-muted-foreground mb-2">التصنيف</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORIES).map(([key, info]) => {
          const Icon = info.icon;
          return (
            <button
              key={key}
              onClick={() => setCategory(key as DocCategory)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                category === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <Icon size={14} />
              {info.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-28" dir="rtl">
      <PageHeader
          title="الوثائق"
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

      {docsLoading ? (
        <ListContentSkeleton />
      ) : (
      <PullToRefresh onRefresh={handleRefresh}>

        {/* Stats bar */}
        {activeList && (
          <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-background">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText size={12} />
                {totalItems} مستند
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

        {/* Category filter */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              activeCategory === "all"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            الكل
          </button>
          {Object.entries(CATEGORIES).map(([key, info]) => {
            const Icon = info.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key as DocCategory)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeCategory === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <Icon size={12} />
                {info.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث في الوثائق..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 bg-card border-border rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="px-4 pt-4 space-y-2 pb-4">
          {filteredItems.map((item) => renderItem(item))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderLock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد وثائق</p>
            </div>
          )}
        </div>

        {/* FAB: directly opens file picker — NO drawer/sheet */}
        <FAB onClick={() => { haptic.medium(); openFilePicker("new"); }} />

        {/* View Document Drawer */}
        <Drawer open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
          <DrawerContent dir="rtl" className="max-h-[85vh]">
            <DrawerHeader className="text-right">
              <DrawerTitle>{viewDoc?.name}</DrawerTitle>
              <DrawerDescription>
                {viewDoc && CATEGORIES[viewDoc.category].label} • {viewDoc?.addedBy}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 space-y-4 overflow-y-auto pb-4">
              {viewDoc?.note && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">{viewDoc.note}</p>
              )}
              {viewDoc?.expiryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-muted-foreground" />
                  <span className="text-foreground">ينتهي: {viewDoc.expiryDate}</span>
                  {viewDoc.reminderEnabled && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      تذكير مفعّل
                    </span>
                  )}
                </div>
              )}
              {viewDoc?.files && viewDoc.files.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">المرفقات ({viewDoc.files.length})</p>
                  {viewDoc.files.map((file) => (
                    <div key={file.id} className="w-full bg-card rounded-xl p-3 flex items-center gap-3 border border-border">
                      {file.type === "image" ? (
                        <img src={file.url} alt={file.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <FileText size={20} className="text-red-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{file.size}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            haptic.light();
                            window.open(file.url, "_blank");
                          }}
                          className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                          title="فتح"
                        >
                          <ExternalLink size={16} className="text-primary" />
                        </button>
                        {navigator.share && (
                          <button
                            onClick={async () => {
                              haptic.light();
                              try {
                                const response = await fetch(file.url);
                                const blob = await response.blob();
                                const shareFile = new globalThis.File([blob], file.name, { type: blob.type });
                                await navigator.share({ title: file.name, files: [shareFile] });
                              } catch {
                                window.open(file.url, "_blank");
                              }
                            }}
                            className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                            title="مشاركة"
                          >
                            <Share2 size={16} className="text-primary" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <File size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">لا توجد مرفقات</p>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-2xl max-w-[90%]" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المستند</AlertDialogTitle>
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

        {/* List Actions Drawer */}
        <Drawer open={showListActions} onOpenChange={setShowListActions}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
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
                onClick={() => { setShowListActions(false); setDeleteListConfirm(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <Trash2 size={16} className="text-destructive" />
                <span className="text-sm font-medium text-destructive">حذف القائمة</span>
              </button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Delete List Confirmation */}
        <Drawer open={deleteListConfirm} onOpenChange={setDeleteListConfirm}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>حذف القائمة</DrawerTitle>
              <DrawerDescription>
                هل أنت متأكد من حذف "{activeList?.name}"؟ سيتم حذف جميع الوثائق داخلها.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="flex-row gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => { setDeleteListConfirm(false); if (activeList) deleteList(activeList.id); }}
              >
                <Trash2 size={16} className="ml-1" />
                حذف نهائي
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteListConfirm(false)}
              >
                إلغاء
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Edit Item Sheet — no file upload here, just metadata */}
        <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <SheetContent side="bottom" dir="rtl" className="max-h-[85dvh] rounded-t-3xl border-none p-0">
            <div className="flex max-h-[85dvh] flex-col overflow-hidden">
              <SheetHeader className="shrink-0 border-b border-border px-4 pt-5 pb-4 text-right">
                <SheetTitle className="text-right">تعديل المستند</SheetTitle>
                <SheetDescription className="text-right">عدّل تفاصيل المستند</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 overflow-y-auto px-4 py-4">
                <Input placeholder="اسم المستند" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
                {renderCategoryForm(editCategory, setEditCategory)}
                <Input placeholder="ملاحظة (اختياري)" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="rounded-xl" />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">تاريخ الانتهاء (اختياري)</p>
                  <Input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} className="rounded-xl" />
                </div>
                {editExpiryDate && (
                  <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-amber-500" />
                      <span className="text-sm text-foreground">تذكير قبل 60 يوم</span>
                    </div>
                    <Switch checked={editReminderEnabled} onCheckedChange={setEditReminderEnabled} />
                  </div>
                )}
                {/* Files list (read-only) + add attachment button */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">المرفقات</p>
                  {editTarget?.files.length ? (
                    <div className="space-y-1.5 mb-2">
                      {editTarget.files.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border">
                          {file.type === "image" ? (
                            <Image size={14} className="text-blue-500" />
                          ) : (
                            <FileText size={14} className="text-red-500" />
                          )}
                          <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground">{file.size}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors w-full"
                    onClick={() => {
                      if (editTarget) openFilePicker("attach", editTarget.id);
                    }}
                  >
                    <Plus size={16} />
                    رفع صورة أو PDF
                  </button>
                </div>
              </div>
              <div className="mt-auto flex shrink-0 flex-row gap-2 border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                <Button onClick={saveEdit} className="flex-1 rounded-xl">حفظ</Button>
                <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl">إلغاء</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Add List Drawer */}
        <Drawer open={showAddList} onOpenChange={setShowAddList}>
          <DrawerContent dir="rtl">
            <DrawerHeader className="text-right">
              <DrawerTitle>إنشاء قائمة وثائق جديدة</DrawerTitle>
              <DrawerDescription>أنشئ قائمة وثائق جديدة</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4">
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
                  key={member.id}
                  onClick={() =>
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
      </PullToRefresh>
      )}

      {/* ══════════════════════════════════════════════════
          UPLOAD OVERLAY — full-screen, NOT a modal library
          No Radix, no Vaul — just a plain div.
          This prevents Android WebView focus-loss issues.
         ══════════════════════════════════════════════════ */}
      {uploadOverlay && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">
              {uploadOverlay.attachToDocumentId ? "إرفاق ملف" : "إضافة مستند جديد"}
            </h2>
            <button
              onClick={cancelUpload}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Upload progress phase */}
            {uploadOverlay.phase === "uploading" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 size={32} className="text-primary animate-spin" />
                </div>
                <p className="text-sm font-medium text-foreground">جاري رفع الملف...</p>
                <p className="text-xs text-muted-foreground truncate max-w-[250px]">{uploadOverlay.file.name}</p>
                <div className="w-full max-w-xs">
                  <Progress value={uploadOverlay.progress} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground">{uploadOverlay.progress}%</p>
              </div>
            )}

            {/* Form phase — file uploaded successfully */}
            {uploadOverlay.phase === "form" && (
              <>
                {/* File preview */}
                <div className="flex flex-col items-center py-4">
                  {uploadOverlay.fileType === "image" && uploadOverlay.previewUrl ? (
                    <img
                      src={uploadOverlay.previewUrl}
                      alt="معاينة"
                      className="w-full max-w-xs h-48 object-cover rounded-2xl border border-border"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <FileText size={40} className="text-red-600" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Check size={16} className="text-emerald-500" />
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">تم رفع الملف بنجاح</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">{uploadOverlay.file.name}</p>
                </div>

                {/* If attaching to existing doc, no need for metadata form */}
                {uploadOverlay.attachToDocumentId ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">سيتم إرفاق هذا الملف بالمستند الحالي</p>
                  </div>
                ) : (
                  <>
                    {/* Metadata form */}
                    <Input
                      placeholder="اسم المستند"
                      value={overlayName}
                      onChange={(e) => setOverlayName(e.target.value)}
                      className="rounded-xl"
                    />
                    {renderCategoryForm(overlayCategory, setOverlayCategory)}
                    <Input
                      placeholder="ملاحظة (اختياري)"
                      value={overlayNote}
                      onChange={(e) => setOverlayNote(e.target.value)}
                      className="rounded-xl"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">تاريخ الانتهاء (اختياري)</p>
                      <Input
                        type="date"
                        value={overlayExpiryDate}
                        onChange={(e) => setOverlayExpiryDate(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    {overlayExpiryDate && (
                      <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                        <div className="flex items-center gap-2">
                          <Bell size={14} className="text-amber-500" />
                          <span className="text-sm text-foreground">تذكير قبل 60 يوم</span>
                        </div>
                        <Switch checked={overlayReminderEnabled} onCheckedChange={setOverlayReminderEnabled} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Bottom action buttons */}
          {uploadOverlay.phase === "form" && (
            <div className="flex flex-row gap-2 border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
              <Button onClick={confirmUpload} className="flex-1 rounded-xl">
                <Upload size={16} className="ml-1" />
                {uploadOverlay.attachToDocumentId ? "إرفاق" : "إضافة للوثائق"}
              </Button>
              <Button variant="outline" onClick={cancelUpload} className="flex-1 rounded-xl">
                إلغاء
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input — lives outside ALL modals */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
};

export default Documents;
