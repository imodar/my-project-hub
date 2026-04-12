import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
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
  phase: "cropping" | "uploading" | "form";
  previewUrl: string | null;
  storagePath: string;
  signedUrl: string;
  fileType: "image" | "pdf";
  /** If set, attach file to this existing document instead of creating a new one */
  attachToDocumentId?: string;
}

/* ── Crop helper: canvas from cropped area ── */
async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<File> {
  appToast.info("DEBUG: getCroppedImg", `src=${imageSrc.substring(0, 40)}...`);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = document.createElement("img");
    // Don't set crossOrigin on blob: URLs — it breaks loading on Capacitor WebView
    if (!imageSrc.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      appToast.success("DEBUG: Image loaded in getCroppedImg", `${img.width}x${img.height}`);
      resolve(img);
    };
    img.onerror = (err) => {
      appToast.error("DEBUG: Image FAILED to load in getCroppedImg", String(err));
      reject(err);
    };
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const bW = image.width * cos + image.height * sin;
  const bH = image.width * sin + image.height * cos;

  canvas.width = bW;
  canvas.height = bH;
  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Now crop
  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new globalThis.File([blob!], "cropped.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
}

const DEFAULT_FAMILY_LIST_ID = "default-family-doc-list";
const DEFAULT_FAMILY_LIST_NAME = "وثائق العائلة";

interface DocumentsUiDraft {
  familyId: string | null;
  activeListId: string;
  uploadOverlay: UploadOverlayState | null;
}

let documentsUiDraft: DocumentsUiDraft = {
  familyId: null,
  activeListId: "",
  uploadOverlay: null,
};

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

  const createdDefaultListRef = useRef<string | null>(null);
  const pendingActiveListIdRef = useRef<string | null>(null);

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
    const filtered = featureAccess.isStaff ? mapped.filter((l: DocList) => l.type !== "family") : mapped;

    // If no family list exists yet, show a placeholder
    const hasFamilyList = filtered.some((l) => l.type === "family");
    if (!hasFamilyList && !featureAccess.isStaff) {
      return [{
        id: DEFAULT_FAMILY_LIST_ID,
        name: DEFAULT_FAMILY_LIST_NAME,
        type: "family" as const,
        isDefault: true,
        sharedWith: [],
        items: [],
        lastUpdatedBy: "",
        lastUpdatedAt: "",
      }, ...filtered];
    }

    return filtered;
  }, [dbDocLists, featureAccess.isStaff]);

  // Auto-create default family list
  useEffect(() => {
    if (documentsUiDraft.familyId !== familyId) {
      documentsUiDraft = {
        familyId: familyId ?? null,
        activeListId: "",
        uploadOverlay: null,
      };
    }
    createdDefaultListRef.current = null;
    pendingActiveListIdRef.current = null;
  }, [familyId]);

  useEffect(() => {
    if (!familyId || featureAccess.isStaff || docsLoading) return;
    const hasFamilyList = (dbDocLists || []).some((l: any) => l.type === "family" || l.is_default);
    if (hasFamilyList || createdDefaultListRef.current === familyId || createDocListMut.isPending) return;

    createdDefaultListRef.current = familyId;
    createDocListMut.mutate({ name: DEFAULT_FAMILY_LIST_NAME, type: "family", shared_with: [], is_default: true });
  }, [familyId, featureAccess.isStaff, docsLoading, dbDocLists]);

  const [activeListId, _setActiveListId] = useState(() =>
    documentsUiDraft.familyId === (familyId ?? null)
      ? documentsUiDraft.activeListId || lists[0]?.id || ""
      : lists[0]?.id || ""
  );
  const setActiveListId = useCallback((value: string | ((prev: string) => string)) => {
    _setActiveListId((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      documentsUiDraft.familyId = familyId ?? null;
      documentsUiDraft.activeListId = next;
      return next;
    });
  }, [familyId]);

  // Auto-select first real list when data loads (only on init or if current list removed)
  const hasInitializedListRef = useRef(false);
  useEffect(() => {
    if (!lists.length) return;
    const exists = lists.some(l => l.id === activeListId);
    if (!hasInitializedListRef.current) {
      hasInitializedListRef.current = true;
      if (activeListId && exists) return;
      const real = lists.find(l => l.id !== DEFAULT_FAMILY_LIST_ID);
      setActiveListId(real?.id || lists[0].id);
      return;
    }
    if (exists) return; // keep current selection
    const real = lists.find(l => l.id !== DEFAULT_FAMILY_LIST_ID);
    setActiveListId(real?.id || lists[0].id);
  }, [lists, activeListId, setActiveListId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<DocCategory | null>(null);
  const [fullPreviewDocId, setFullPreviewDocId] = useState<string | null>(null);
  const [showAddList, setShowAddList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null); // kept for potential use

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
  const [uploadOverlay, _setUploadOverlay] = useState<UploadOverlayState | null>(() =>
    documentsUiDraft.familyId === (familyId ?? null) ? documentsUiDraft.uploadOverlay : null
  );
  const setUploadOverlay = useCallback((v: UploadOverlayState | null | ((prev: UploadOverlayState | null) => UploadOverlayState | null)) => {
    _setUploadOverlay((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      documentsUiDraft.familyId = familyId ?? null;
      documentsUiDraft.uploadOverlay = next;
      if (prev && !next) {
        appToast.warning("DEBUG: uploadOverlay RESET to null", new Error().stack?.split("\n")[2]?.trim() || "");
      }
      if (!prev && next) {
        appToast.info("DEBUG: uploadOverlay SET", `phase=${next.phase}`);
      }
      return next;
    });
  }, [familyId]);
  const [overlayName, setOverlayName] = useState("");
  const [overlayCategory, setOverlayCategory] = useState<DocCategory>("identity");
  const [overlayNote, setOverlayNote] = useState("");
  const [overlayExpiryDate, setOverlayExpiryDate] = useState("");
  const [overlayReminderEnabled, setOverlayReminderEnabled] = useState(false);

  // Crop state
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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

  // Derive fullPreviewDoc from live data instead of stale snapshot
  const fullPreviewDoc = useMemo(() =>
    fullPreviewDocId ? (activeList?.items.find(i => i.id === fullPreviewDocId) ?? null) : null,
    [activeList, fullPreviewDocId]
  );

  const filteredItems = useMemo(() =>
    activeList?.items.filter((item) => {
      const matchesSearch = !searchQuery || item.name.includes(searchQuery) || item.note.includes(searchQuery);
      const matchesCategory = !activeCategory || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    }) || [],
    [activeList, searchQuery, activeCategory]
  );

  // Group items by category for card-stack view
  const groupedByCategory = useMemo(() => {
    const groups: Record<DocCategory, DocumentItem[]> = {
      identity: [], medical: [], vehicles: [], home: [], passport: [], other: [],
    };
    filteredItems.forEach((item) => {
      groups[item.category].push(item);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0) as [DocCategory, DocumentItem[]][];
  }, [filteredItems]);

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
    appToast.info("DEBUG: openFilePicker", `mode=${mode}, docId=${documentId || "none"}`);
    pickerModeRef.current = mode;
    attachTargetRef.current = documentId || null;
    if (mode === "attach") {
      setEditTarget(null);
    }
    fileInputRef.current?.click();
    appToast.info("DEBUG: click() called on input", `inputExists=${!!fileInputRef.current}`);
  }, []);

  // Ref to keep activeListId fresh for upload callbacks
  const activeListIdRef = useRef(activeListId);
  useEffect(() => { activeListIdRef.current = activeListId; }, [activeListId]);

  useEffect(() => {
    if (documentsUiDraft.familyId === (familyId ?? null) && documentsUiDraft.uploadOverlay) {
      appToast.warning("DEBUG: Documents remounted", `restored phase=${documentsUiDraft.uploadOverlay.phase}`);
    }

    return () => {
      if (documentsUiDraft.familyId === (familyId ?? null) && documentsUiDraft.uploadOverlay) {
        appToast.warning("DEBUG: Documents unmounted", `pending phase=${documentsUiDraft.uploadOverlay.phase}`);
      }
    };
  }, [familyId]);

  /* ── Upload a file to storage (shared by crop confirm + PDF direct) ── */
  const startUpload = useCallback(async (fileToUpload: File, overlay: UploadOverlayState) => {
    appToast.info("DEBUG: startUpload", `name=${fileToUpload.name}, size=${fileToUpload.size}, type=${fileToUpload.type}`);

    let progressInterval: ReturnType<typeof setInterval> | undefined;
    try {
      progressInterval = setInterval(() => {
        setUploadOverlay(prev => {
          if (!prev || prev.phase !== "uploading") return prev;
          const next = Math.min(prev.progress + 15, 90);
          return { ...prev, progress: next };
        });
      }, 300);

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(overlay.storagePath, fileToUpload, { contentType: fileToUpload.type, upsert: false });

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
          await cache.put(overlay.storagePath, new Response(fileToUpload));
        }
      } catch {}

      // Get signed URL — 2 hours instead of 1 year for sensitive documents
      const { data: signedData } = await supabase.storage
        .from("documents")
        .createSignedUrl(overlay.storagePath, 60 * 60 * 2);
      const signedUrl = signedData?.signedUrl || overlay.storagePath;

      setUploadOverlay(prev => {
        // Revoke old preview if replacing
        if (prev?.previewUrl && fileToUpload.type.startsWith("image/")) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return prev ? {
          ...prev,
          file: fileToUpload,
          progress: 100,
          phase: "form",
          signedUrl,
          previewUrl: fileToUpload.type.startsWith("image/") ? URL.createObjectURL(fileToUpload) : prev.previewUrl,
        } : null;
      });

    } catch (err) {
      console.error("[Documents] Upload error:", err);
      appToast.error("حدث خطأ أثناء رفع الملف");
      setUploadOverlay(null);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
  }, []);

  /* ── Handle file selection → crop (image) or upload (PDF) ── */
  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    appToast.info("DEBUG: handleFileSelected triggered");
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      appToast.error("DEBUG: No file found in input.files", `files length=${input.files?.length ?? "null"}`);
      return;
    }
    appToast.info("DEBUG: File selected", `name=${file.name}, size=${file.size}, type=${file.type}`);
    // Don't clear input.value here — on some Android WebViews it
    // invalidates the File reference. We clear it after processing.

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

    const fileId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${familyId}/${fileId}.${ext}`;
    const attachId = pickerModeRef.current === "attach" ? (attachTargetRef.current || undefined) : undefined;

    // Reset form fields
    setOverlayName(file.name.replace(/\.[^.]+$/, ""));
    setOverlayCategory("identity");
    setOverlayNote("");
    setOverlayExpiryDate("");
    setOverlayReminderEnabled(false);

    if (isImage) {
      const previewUrl = URL.createObjectURL(file);
      appToast.info("DEBUG: Image preview blob created", previewUrl.substring(0, 50));
      setCropState({ x: 0, y: 0 });
      setCropZoom(1);
      setCropRotation(0);
      setCroppedAreaPixels(null);
      setUploadOverlay({
        file,
        progress: 0,
        phase: "cropping",
        previewUrl,
        storagePath,
        signedUrl: "",
        fileType: "image",
        attachToDocumentId: attachId,
      });
      appToast.info("DEBUG: Crop overlay set");
    } else {
      // PDF: upload directly
      const overlay: UploadOverlayState = {
        file,
        progress: 0,
        phase: "uploading",
        previewUrl: null,
        storagePath,
        signedUrl: "",
        fileType: "pdf",
        attachToDocumentId: attachId,
      };
      startUpload(file, overlay);
    }
  }, [familyId, startUpload]);

  /* ── Confirm crop → proceed to upload ── */
  const confirmCrop = useCallback(async () => {
    appToast.info("DEBUG: confirmCrop called", `previewUrl=${!!uploadOverlay?.previewUrl}, croppedArea=${!!croppedAreaPixels}`);
    if (!uploadOverlay || !uploadOverlay.previewUrl || !croppedAreaPixels) {
      appToast.error("DEBUG: confirmCrop aborted — missing data");
      return;
    }
    try {
      const croppedFile = await getCroppedImg(uploadOverlay.previewUrl, croppedAreaPixels, cropRotation);
      appToast.success("DEBUG: Crop done", `size=${croppedFile.size}`);
      const newPreview = URL.createObjectURL(croppedFile);
      if (uploadOverlay.previewUrl) URL.revokeObjectURL(uploadOverlay.previewUrl);
      startUpload(croppedFile, { ...uploadOverlay, previewUrl: newPreview });
    } catch (err) {
      console.error("[Documents] Crop error:", err);
      appToast.error("DEBUG: Crop FAILED", String(err));
    }
  }, [uploadOverlay, croppedAreaPixels, cropRotation, startUpload]);

  /* ── Confirm: save file to DB ── */
  const confirmUpload = useCallback(async () => {
    if (!uploadOverlay) return;

    // If attaching to an existing document, no list needed
    const currentListId = activeListIdRef.current;
    if (!uploadOverlay.attachToDocumentId && (!currentListId || currentListId === DEFAULT_FAMILY_LIST_ID)) {
      appToast.error("جارٍ تجهيز القائمة العائلية، حاول مرة أخرى");
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Create new document with file
    try {
      const result = await addDocItemMut.mutateAsync({
        list_id: currentListId,
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

    if (uploadOverlay.previewUrl) URL.revokeObjectURL(uploadOverlay.previewUrl);
    setUploadOverlay(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadOverlay, overlayName, overlayCategory, overlayNote, overlayExpiryDate, overlayReminderEnabled, addDocItemMut, addDocFileMut]);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
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

        {/* Category filter — no "الكل" tab */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {Object.entries(CATEGORIES).map(([key, info]) => {
            const Icon = info.icon;
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(isActive ? null : key as DocCategory)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
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

        {/* Card stacks grouped by category */}
        <div className="px-4 pt-4 space-y-6 pb-4">
          {groupedByCategory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderLock size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد وثائق</p>
            </div>
          )}

          {groupedByCategory.map(([category, items]) => {
            const catInfo = CATEGORIES[category];
            const CatIcon = catInfo.icon;
            return (
              <div key={category} className="space-y-2">
                {/* Category header */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${catInfo.bg}`}>
                    <CatIcon size={14} className={catInfo.color} />
                  </div>
                  <span className="text-sm font-bold text-foreground">{catInfo.label}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
                </div>

                {/* Overlapping vertical card stack */}
                <div className="relative" style={{ height: `${items.length * 48 + 120}px` }}>
                  {items.map((item, idx) => {
                    const expiryStatus = getExpiryStatus(item.expiryDate);
                    const hasThumb = item.files.length > 0 && item.files[0].type === "image";
                    const zIndex = idx + 1;

                    return (
                      <div
                        key={item.id}
                        className="absolute right-0 left-0 cursor-pointer transition-all duration-200 active:scale-[0.98]"
                        style={{ top: `${idx * 48}px`, zIndex }}
                        onClick={() => { haptic.light(); setFullPreviewDocId(item.id); }}
                      >
                        <div className="rounded-2xl overflow-hidden border border-border shadow-md relative">
                          {/* Full-width image/icon — fills entire card */}
                          {hasThumb ? (
                            <img
                              src={item.files[0].url}
                              alt={item.name}
                              className="w-full h-36 object-cover"
                            />
                          ) : (
                            <div className={`w-full h-36 flex items-center justify-center ${catInfo.bg}`}>
                              <CatIcon size={36} className={catInfo.color} />
                            </div>
                          )}

                          {/* Info overlay — transparent, on top of image */}
                          <div className="absolute inset-x-0 top-0 flex items-start gap-2 px-3 pt-2" style={{ background: "linear-gradient(to bottom, hsl(var(--background) / 0.75) 0%, hsl(var(--background) / 0.5) 30%, hsl(var(--background) / 0.2) 60%, transparent 100%)", paddingBottom: "3rem" }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate drop-shadow-sm">{item.name}</p>
                            </div>
                            {expiryStatus && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${expiryStatus.className}`}>
                                {expiryStatus.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAB: directly opens file picker — NO drawer/sheet */}
        {/* FAB: directly opens file picker — haptic AFTER click to preserve gesture chain */}
        <FAB skipHaptic onClick={() => { openFilePicker("new"); }} />

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
          FULL-SCREEN DOCUMENT PREVIEW
         ══════════════════════════════════════════════════ */}
      {fullPreviewDoc && (() => {
        const catInfo = CATEGORIES[fullPreviewDoc.category];
        const CatIcon = catInfo.icon;
        const expiryStatus = getExpiryStatus(fullPreviewDoc.expiryDate);
        const mainFile = fullPreviewDoc.files[0];

        return (
          <div className="fixed inset-0 z-[90] bg-background flex flex-col" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${catInfo.bg}`}>
                  <CatIcon size={16} className={catInfo.color} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground truncate">{fullPreviewDoc.name}</h2>
                  <p className="text-[11px] text-muted-foreground">{catInfo.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {navigator.share && mainFile && (
                  <button
                    onClick={async () => {
                      haptic.light();
                      try {
                        const response = await fetch(mainFile.url);
                        const blob = await response.blob();
                        const shareFile = new globalThis.File([blob], mainFile.name, { type: blob.type });
                        await navigator.share({ title: fullPreviewDoc.name, files: [shareFile] });
                      } catch {
                        if (mainFile.url) window.open(mainFile.url, "_blank");
                      }
                    }}
                    className="p-2 rounded-xl hover:bg-muted transition-colors"
                  >
                    <Share2 size={20} className="text-primary" />
                  </button>
                )}
                <button
                  onClick={() => setFullPreviewDocId(null)}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Main image/pdf preview */}
              {mainFile ? (
                <div className="w-full flex items-center justify-center bg-muted/30 p-4">
                  {mainFile.type === "image" ? (
                    <img
                      src={mainFile.url}
                      alt={fullPreviewDoc.name}
                      className="max-w-full max-h-[50vh] object-contain rounded-2xl border border-border shadow-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <FileText size={40} className="text-red-600 dark:text-red-400" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{mainFile.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => window.open(mainFile.url, "_blank")}
                      >
                        <ExternalLink size={14} className="ml-1" />
                        فتح PDF
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <File size={40} className="mb-3 opacity-30" />
                  <p className="text-sm">لا توجد مرفقات</p>
                </div>
              )}

              {/* Document details */}
              <div className="px-4 py-4 space-y-3">
                {fullPreviewDoc.note && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-sm text-foreground">{fullPreviewDoc.note}</p>
                  </div>
                )}

                {expiryStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-foreground">ينتهي: {fullPreviewDoc.expiryDate}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${expiryStatus.className}`}>
                      {expiryStatus.label}
                    </span>
                    {fullPreviewDoc.reminderEnabled && (
                      <Bell size={12} className="text-amber-500" />
                    )}
                  </div>
                )}

                {/* All files */}
                {fullPreviewDoc.files.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">كل المرفقات ({fullPreviewDoc.files.length})</p>
                    {fullPreviewDoc.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
                        {file.type === "image" ? (
                          <img src={file.url} alt={file.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <FileText size={16} className="text-red-600 dark:text-red-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground">{file.size}</p>
                        </div>
                        <button
                          onClick={() => window.open(file.url, "_blank")}
                          className="p-2 rounded-lg hover:bg-muted"
                        >
                          <ExternalLink size={14} className="text-primary" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex flex-row gap-2 border-t border-border px-4 pt-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => { openEdit(fullPreviewDoc); setFullPreviewDocId(null); }}
              >
                <Pencil size={14} className="ml-1" />
                تعديل
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { setDeleteTarget(fullPreviewDoc); setFullPreviewDocId(null); }}
              >
                <Trash2 size={14} className="ml-1" />
                حذف
              </Button>
            </div>
          </div>
        );
      })()}
      {/* UPLOAD OVERLAY */}
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

          {/* Crop phase — image only */}
          {uploadOverlay.phase === "cropping" && uploadOverlay.previewUrl && (
            <>
              <div className="flex-1 relative bg-black/90">
                <Cropper
                  image={uploadOverlay.previewUrl}
                  crop={cropState}
                  zoom={cropZoom}
                  rotation={cropRotation}
                  aspect={4 / 3}
                  onCropChange={setCropState}
                  onZoomChange={setCropZoom}
                  onRotationChange={setCropRotation}
                  onCropComplete={(_, area) => setCroppedAreaPixels(area)}
                />
              </div>
              {/* Crop controls */}
              <div className="px-4 py-3 space-y-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">تكبير</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={cropZoom}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">استدارة</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={cropRotation}
                    onChange={(e) => setCropRotation(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-[10px] text-muted-foreground w-8 text-center">{cropRotation}°</span>
                </div>
              </div>
              <div className="flex flex-row gap-2 border-t border-border px-4 pt-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                <Button onClick={confirmCrop} className="flex-1 rounded-xl">
                  <Check size={16} className="ml-1" />
                  تأكيد القص
                </Button>
                <Button variant="outline" onClick={() => {
                  // Skip crop, upload original
                  startUpload(uploadOverlay.file, { ...uploadOverlay });
                }} className="flex-1 rounded-xl">
                  تخطي
                </Button>
                <Button variant="ghost" onClick={cancelUpload} className="rounded-xl px-3">
                  <X size={16} className="text-muted-foreground" />
                </Button>
              </div>
            </>
          )}

          {/* Upload + Form phases */}
          {(uploadOverlay.phase === "uploading" || uploadOverlay.phase === "form") && (
          <>
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
          </>
          )}
        </div>
      )}

      {/* Hidden file input — lives outside ALL modals */}
      {/* Hidden file input — off-screen 1px for maximum WebView compat */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{
          position: "fixed",
          top: "-1000px",
          left: "-1000px",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={handleFileSelected}
      />
    </div>
  );
};

export default Documents;
