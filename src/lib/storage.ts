import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "crypto";

type BucketName = "avatars" | "documents" | "album-photos" | "trip-documents";

interface UploadResult {
  url: string;
  path: string;
  error: string | null;
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
 */
export function validateFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): string | null {
  const maxSize = (options?.maxSizeMB || 10) * 1024 * 1024;
  if (file.size > maxSize) {
    return `حجم الملف يتجاوز ${options?.maxSizeMB || 10} ميجابايت`;
  }
  if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
    return "نوع الملف غير مدعوم";
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
  const validationError = validateFile(file, {
    maxSizeMB: 5,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (validationError) {
    return { url: "", path: "", error: validationError };
  }
  return uploadFile(bucket, file, folder);
}
