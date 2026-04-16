import { supabase } from "@/integrations/supabase/client";

type BucketName = "avatars" | "documents" | "album-photos" | "trip-documents" | "chat-media";

interface UploadResult {
  url: string;
  path: string;
  error: string | null;
}

/* ── File Signature (Magic Bytes) Validation ── */

const FILE_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png":  [[0x89, 0x50, 0x4E, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF
  "image/gif":  [[0x47, 0x49, 0x46]],        // GIF
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

async function validateFileSignature(file: File): Promise<boolean> {
  const sigs = FILE_SIGNATURES[file.type];
  if (!sigs) return false; // unknown type → reject
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return sigs.some(sig => sig.every((b, i) => bytes[i] === b));
}

/**
 * Upload a file to Supabase Storage.
 * Returns the public/signed URL.
 */
export async function uploadFile(
  bucket: BucketName,
  file: File,
  folder?: string
): Promise<UploadResult> {
  const ext = file.name.split(".").pop() || "bin";
  const id = crypto.randomUUID?.() || Date.now().toString(36);
  const filePath = folder ? `${folder}/${id}.${ext}` : `${id}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    return { url: "", path: "", error: error.message };
  }

  // Public buckets get a public URL, private ones get a signed URL
  if (bucket === "avatars") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { url: data.publicUrl, path: filePath, error: null };
  }

  // Private buckets: create a signed URL (1 hour)
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);

  if (signError || !signed) {
    return { url: "", path: filePath, error: signError?.message || "Failed to sign URL" };
  }

  return { url: signed.signedUrl, path: filePath, error: null };
}

/**
 * Get a fresh signed URL for a private file.
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (bucket === "avatars") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

/**
 * Validate file before upload.
 * When allowedTypes is provided, also validates file signature (magic bytes).
 */
export async function validateFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): Promise<string | null> {
  const maxSize = (options?.maxSizeMB || 10) * 1024 * 1024;
  if (file.size > maxSize) {
    return `حجم الملف يتجاوز ${options?.maxSizeMB || 10} ميجابايت`;
  }
  if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
    return "نوع الملف غير مدعوم";
  }
  // Validate file signature when allowedTypes is specified
  if (options?.allowedTypes) {
    const signatureValid = await validateFileSignature(file);
    if (!signatureValid) {
      return "محتوى الملف لا يتطابق مع نوعه — قد يكون ملفاً مزيّفاً";
    }
  }
  return null;
}

/**
 * Image-specific upload with compression option.
 */
export async function uploadImage(
  bucket: BucketName,
  file: File,
  folder?: string
): Promise<UploadResult> {
  const validationError = await validateFile(file, {
    maxSizeMB: 5,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (validationError) {
    return { url: "", path: "", error: validationError };
  }
  return uploadFile(bucket, file, folder);
}
