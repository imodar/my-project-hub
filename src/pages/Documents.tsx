import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { flushSync } from "react-dom";
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
  ChevronDown, ChevronUp, BookOpen, ExternalLink, X
} from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useUserRole } from "@/contexts/UserRoleContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
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
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";

type DocCategory = "identity" | "medical" | "vehicles" | "home" | "passport" | "other";

interface DocFile {
  id: string;
  name: string;
  type: "image" | "pdf";
  url: string; // base64 or object URL
  size: string;
  rawSize?: number; // raw bytes, needed for add-file API
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

// FAMILY_MEMBERS removed — using useFamilyMembers hook
const SWIPE_WIDTH = 140;

// Initial data removed — using Supabase hooks

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
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const pointerStartYRef = useRef(0);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  // Edit item
  const [editTarget, setEditTarget] = useState<DocumentItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<DocCategory>("identity");
  const [editNote, setEditNote] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);

  // New item form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<DocCategory>("identity");
  const [newNote, setNewNote] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [newReminderEnabled, setNewReminderEnabled] = useState(false);
  const [newFiles, setNewFiles] = useState<DocFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const isPickingFileRef = useRef(false);
  const pickerResetTimeoutRef = useRef<number | null>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const setPickerLock = useCallback((locked: boolean) => {
    isPickingFileRef.current = locked;
  }, []);

  const clearPickerLockTimeout = useCallback(() => {
    if (pickerResetTimeoutRef.current !== null) {
      window.clearTimeout(pickerResetTimeoutRef.current);
      pickerResetTimeoutRef.current = null;
    }
  }, []);

  const schedulePickerUnlock = useCallback((delay = 2000) => {
    clearPickerLockTimeout();
    pickerResetTimeoutRef.current = window.setTimeout(() => {
      setPickerLock(false);
      pickerResetTimeoutRef.current = null;
    }, delay);
  }, [clearPickerLockTimeout, setPickerLock]);

  const primeFilePickerLock = useCallback(() => {
    flushSync(() => {
      setPickerLock(true);
    });
    schedulePickerUnlock(10000);
  }, [schedulePickerUnlock, setPickerLock]);

  const triggerFilePicker = useCallback(async (target: "new" | "existing") => {
    // ── Native path (Android / iOS) ──────────────────────────────────────────
    // @capawesome/capacitor-file-picker returns files via JS Promise, so the Sheet
    // open/close state and DOM mutations never affect whether the file is received.
    // Falls back silently to <input type="file"> when the plugin is not compiled
    // into the current build (UNIMPLEMENTED) or Capacitor is not available.
    let useHtmlInput = true; // will be set false if native path handles everything

    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("FilePicker")) {
        useHtmlInput = false;
        setIsUploadingFile(true);
        setPickerLock(true);
        clearPickerLockTimeout();

        let shouldFallbackToHtml = false;

        try {
          const { FilePicker } = await import("@capawesome/capacitor-file-picker");
          const result = await FilePicker.pickFiles({
            types: ["image/*", "application/pdf"],
            multiple: true,
            readData: true, // always return base64 — avoids content:// URI issues on Android
          });

          for (const pickedFile of result.files) {
            const isImage = pickedFile.mimeType?.startsWith("image/") ?? false;
            const isPdf   = pickedFile.mimeType === "application/pdf";
            if (!isImage && !isPdf) continue;

            if (!familyId) { appToast.error("لا يمكن رفع الملف بدون عائلة"); continue; }

            // Use base64 data directly — content:// URIs on Android cannot be
            // converted via Capacitor.convertFileSrc(), so readData:true is required.
            if (!pickedFile.data) { appToast.error("تعذّر قراءة الملف"); continue; }
            const mime = pickedFile.mimeType ?? (isImage ? "image/jpeg" : "application/pdf");
            const blob = await (await fetch(`data:${mime};base64,${pickedFile.data}`)).blob();

            const file      = new File([blob], pickedFile.name, { type: mime });
            const sizeLabel = file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(0)} KB`
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

            const fileId      = crypto.randomUUID();
            const ext         = pickedFile.name.split(".").pop() || "bin";
            const storagePath = `${familyId}/${fileId}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from("documents")
              .upload(storagePath, file, { contentType: file.type, upsert: false });

            if (uploadError) {
              console.error("[Documents] Native upload failed:", uploadError);
              appToast.error("فشل رفع الملف إلى التخزين السحابي");
              continue;
            }

            try {
              if ("caches" in window) {
                const cache = await caches.open("documents-cache-v1");
                await cache.put(storagePath, new Response(blob));
              }
            } catch {}

            const { data: signedData } = await supabase.storage
              .from("documents")
              .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
            const url = signedData?.signedUrl || storagePath;

            const docFile: DocFile = {
              id: fileId, name: pickedFile.name,
              type: isImage ? "image" : "pdf",
              url, size: sizeLabel, rawSize: file.size,
              addedAt: new Date().toISOString(),
            };

            if (target === "new") {
              setNewFiles((prev) => [...prev, docFile]);
              setShowAddItem(true); // re-open if focus-management accidentally closed it
            } else {
              if (!editTarget) { appToast.error("تعذّر تحديد المستند لإرفاق الملف"); continue; }
              setEditTarget((prev) => prev ? ({ ...prev, files: [...prev.files, docFile] }) : prev);
              addDocFileMut.mutate({
                document_id: editTarget.id, name: pickedFile.name,
                file_url: url, type: isImage ? "image" : "pdf", size: file.size,
              });
            }
          }
        } catch (err: any) {
          const msg = String(err?.message ?? err ?? "");
          const isCancel  = /cancel|user/i.test(msg);
          const isNotImpl = /not implemented|unimplemented/i.test(msg);

          if (isCancel) {
            // User cancelled — nothing to do
          } else if (isNotImpl) {
            // Native plugin not compiled yet → fall back silently
            console.warn("[Documents] FilePicker not implemented, falling back to <input>:", msg);
            shouldFallbackToHtml = true;
          } else {
            console.error("[Documents] Native FilePicker error:", err);
            appToast.error("فشل رفع الملف");
          }
        } finally {
          setIsUploadingFile(false);
          setPickerLock(false);
        }

        if (!shouldFallbackToHtml) return; // native path handled everything
        useHtmlInput = true;               // will use <input> below
      }
    } catch {
      // Capacitor module not available → web environment
    }

    if (!useHtmlInput) return;

    // ── Web / <input type="file"> fallback path ────────────────────────────────
    if (!isPickingFileRef.current) primeFilePickerLock();
    const input = target === "new" ? newFileInputRef.current : editFileInputRef.current;
    if (!input) { setPickerLock(false); return; }
    input.click();
  }, [addDocFileMut, clearPickerLockTimeout, editTarget, familyId, primeFilePickerLock, setPickerLock]);

  // Reset isPickingFileRef when WebView regains focus (user returned from file picker)
  useEffect(() => {
    const onWindowFocus = () => {
      if (isPickingFileRef.current) {
        schedulePickerUnlock(2000);
      }
    };
    window.addEventListener("focus", onWindowFocus);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
      clearPickerLockTimeout();
    };
  }, [clearPickerLockTimeout, schedulePickerUnlock]);

  // New list form
  const [newListName, setNewListName] = useState("");
  const [newListShareMembers, setNewListShareMembers] = useState<string[]>([]);

  // Share form
  const [selectedShareMembers, setSelectedShareMembers] = useState<string[]>([]);
  const [showListActions, setShowListActions] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState(false);

  const activeList = lists.find((l) => l.id === activeListId);

  const filteredItems = activeList?.items.filter((item) => {
    const matchesSearch = !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const totalItems = activeList?.items.length || 0;

  // Check expiry status
  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "منتهي", className: "bg-destructive/10 text-destructive" };
    if (diffDays <= 60) return { label: `${diffDays} يوم`, className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" };
    return { label: `${diffDays} يوم`, className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" };
  };

  // Swipe handlers moved to SwipeableCard component

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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, target: "new" | "existing") => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      schedulePickerUnlock(300);
      return;
    }

    setIsUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) continue;

        const sizeLabel = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(0)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        // Upload to Supabase Storage with familyId prefix for RLS
        const fileId = crypto.randomUUID();
        const ext = file.name.split(".").pop() || "bin";
        if (!familyId) {
          appToast.error("لا يمكن رفع الملف بدون عائلة");
          continue;
        }
        const storagePath = `${familyId}/${fileId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          console.error("[Documents] Upload failed:", uploadError);
          appToast.error("فشل رفع الملف إلى التخزين السحابي");
          continue;
        }

        // Cache blob locally for offline access
        try {
          if ("caches" in window) {
            const cache = await caches.open("documents-cache-v1");
            await cache.put(storagePath, new Response(file));
          }
        } catch {}

        // Get signed URL for display
        const { data: signedData } = await supabase.storage
          .from("documents")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
        const url = signedData?.signedUrl || storagePath;

        const docFile: DocFile = {
          id: fileId,
          name: file.name,
          type: isImage ? "image" : "pdf",
          url,
          size: sizeLabel,
          rawSize: file.size,
          addedAt: new Date().toISOString(),
        };

        if (target === "new") {
          setNewFiles((prev) => [...prev, docFile]);
          continue;
        }

        if (!editTarget) {
          appToast.error("تعذّر تحديد المستند لإرفاق الملف");
          continue;
        }

        setEditTarget((prev) => prev ? ({ ...prev, files: [...prev.files, docFile] }) : prev);
        addDocFileMut.mutate({
          document_id: editTarget.id,
          name: file.name,
          file_url: url,
          type: isImage ? "image" : "pdf",
          size: file.size,
        });
      }
    } finally {
      e.target.value = "";
      setIsUploadingFile(false);
      schedulePickerUnlock(600);
    }
  }, [addDocFileMut, editTarget, familyId, schedulePickerUnlock]);

  const addItem = useCallback(async () => {
    if (!newName.trim() || !activeListId) return;
    haptic.medium();

    // Capture values before clearing state
    const filesToAttach = [...newFiles];
    const itemPayload = {
      list_id: activeListId, name: newName.trim(), category: newCategory,
      note: newNote.trim(), expiry_date: newExpiryDate || undefined,
      reminder_enabled: newReminderEnabled,
    };

    // Optimistically reset form and close drawer
    setNewName(""); setNewNote(""); setNewCategory("identity");
    setNewExpiryDate(""); setNewReminderEnabled(false); setNewFiles([]);
    setShowAddItem(false);

    try {
      const result = await addDocItemMut.mutateAsync(itemPayload);
      const documentId = (result as any)?.data?.id;
      if (documentId && filesToAttach.length > 0) {
        for (const file of filesToAttach) {
          addDocFileMut.mutate({
            document_id: documentId,
            name: file.name,
            file_url: file.url,
            type: file.type,
            size: file.rawSize ?? 0,
          });
        }
      }
    } catch (err) {
      console.error("[Documents] Failed to add document:", err);
    }
  }, [activeListId, newName, newCategory, newNote, newExpiryDate, newReminderEnabled, newFiles, addDocItemMut, addDocFileMut]);

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

        <FAB onClick={() => { haptic.medium(); setShowAddItem(true); }} />

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

        {/* Edit Item Sheet */}
        <Sheet open={!!editTarget} onOpenChange={(open) => { if (!open && isPickingFileRef.current) return; if (!open) setEditTarget(null); }}>
          <SheetContent
            side="bottom"
            dir="rtl"
            className="max-h-[85dvh] rounded-t-3xl border-none p-0"
            onInteractOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
            onFocusOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
            onPointerDownOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
          >
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
                <div>
                  <p className="text-xs text-muted-foreground mb-2">إضافة مرفقات</p>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
                    onPointerDownCapture={(e) => {
                      e.stopPropagation();
                      primeFilePickerLock();
                    }}
                    onClick={() => { void triggerFilePicker("existing"); }}
                  >
                    <Plus size={16} />
                    رفع صورة أو PDF
                  </button>
                  {editTarget?.files.length ? (
                    <div className="space-y-1.5 mt-2">
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
                </div>
              </div>
              <div className="mt-auto flex shrink-0 flex-row gap-2 border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                <Button onClick={saveEdit} className="flex-1 rounded-xl">حفظ</Button>
                <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl">إلغاء</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Add Item Sheet */}
        <Sheet open={showAddItem} onOpenChange={(open) => {
          if (!open && isPickingFileRef.current) return;
          setShowAddItem(open);
        }}>
          <SheetContent
            side="bottom"
            dir="rtl"
            className="max-h-[85dvh] rounded-t-3xl border-none p-0"
            onInteractOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
            onFocusOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
            onPointerDownOutside={(e) => { if (isPickingFileRef.current) e.preventDefault(); }}
          >
            <div className="flex max-h-[85dvh] flex-col overflow-hidden">
              <SheetHeader className="shrink-0 border-b border-border px-4 pt-5 pb-4 text-right">
                <SheetTitle className="text-right">إضافة مستند جديد</SheetTitle>
                <SheetDescription className="text-right">أضف وثيقة مع التصنيف والمرفقات</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 overflow-y-auto px-4 py-4">
                <Input placeholder="اسم المستند" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl" />
                {renderCategoryForm(newCategory, setNewCategory)}
                <Input placeholder="ملاحظة (اختياري)" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="rounded-xl" />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">تاريخ الانتهاء (اختياري)</p>
                  <Input type="date" value={newExpiryDate} onChange={(e) => setNewExpiryDate(e.target.value)} className="rounded-xl" />
                </div>
                {newExpiryDate && (
                  <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-amber-500" />
                      <span className="text-sm text-foreground">تذكير قبل 60 يوم</span>
                    </div>
                    <Switch checked={newReminderEnabled} onCheckedChange={setNewReminderEnabled} />
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">المرفقات</p>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
                    onPointerDownCapture={(e) => {
                      e.stopPropagation();
                      primeFilePickerLock();
                    }}
                    onClick={() => { void triggerFilePicker("new"); }}
                  >
                    <Plus size={16} />
                    رفع صورة أو PDF
                  </button>
                  {newFiles.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {newFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border">
                          {file.type === "image" ? (
                            <Image size={14} className="text-blue-500" />
                          ) : (
                            <FileText size={14} className="text-red-500" />
                          )}
                          <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground">{file.size}</span>
                          <button
                            onClick={() => setNewFiles((prev) => prev.filter((f) => f.id !== file.id))}
                            className="text-destructive"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-auto flex shrink-0 flex-row gap-2 border-t border-border px-4 pt-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                <Button onClick={addItem} disabled={isUploadingFile} className="flex-1 rounded-xl">
                  {isUploadingFile ? "جاري الرفع..." : "إضافة"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddItem(false)} className="flex-1 rounded-xl">إلغاء</Button>
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
      </PullToRefresh>
      )}

      {/*
        *** FIX: File inputs MUST live outside every Sheet/Dialog. ***
        On Android (Capacitor WebView), when a native file-picker opens the
        WebView loses focus. Radix UI Dialog's DismissableLayer fires
        onFocusOutside / onPointerDownOutside which can close the Sheet even
        with our isPickingFileRef guard. Once the Sheet unmounts its children,
        the <input type="file"> element is removed from the DOM. Android then
        cannot deliver the selected file back → onChange never fires → "drawer
        closes, no action happens".

        Keeping both inputs permanently mounted here (outside any Sheet) means
        Android always has a live DOM node to deliver the file result to,
        regardless of what the Sheet does.
      */}
      <input
        ref={newFileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => { void handleFileUpload(e, "new"); }}
      />
      <input
        ref={editFileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => { void handleFileUpload(e, "existing"); }}
      />
    </div>
  );
};

export default Documents;
