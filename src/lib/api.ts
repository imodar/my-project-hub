import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

/**
 * إصدار التطبيق — يُرسَل مع كل طلب API.
 */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";

/** مهلة الطلبات الافتراضية (15 ثانية) */
const REQUEST_TIMEOUT_MS = 15_000;

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** مهلة مخصصة بالميلي ثانية (الافتراضي 15 ثانية) */
  timeout?: number;
}

interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * يستخرج الـ status بشكل موثوق من أخطاء Supabase Functions.
 * - FunctionsHttpError يحوي context.status (HTTP status حقيقي).
 * - fallback لـ regex فقط كحل أخير.
 */
async function extractErrorDetails(
  error: unknown
): Promise<{ status: number; message: string; body: unknown }> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? 500;
    let body: unknown = null;
    try {
      body = await error.context.json();
    } catch {
      try {
        body = await error.context.text();
      } catch {
        /* ignore */
      }
    }
    const message =
      (typeof body === "object" && body && "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : null) || error.message || `HTTP ${status}`;
    return { status, message, body };
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return { status: 0, message: error.message || "Network error", body: null };
  }

  // Fallback: استخرج الـ status من رسالة Supabase إن وُجدت بنمط محدد جداً
  // مثال: "Edge Function returned a non-2xx status code: 426"
  const message = error instanceof Error ? error.message : "خطأ غير متوقع";
  const statusMatch = message.match(/non-2xx status code[:\s]+(\d{3})/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
  return { status, message, body: null };
}

/**
 * Unified API client for Supabase Edge Functions.
 *
 * - Automatically includes JWT auth header (via supabase client)
 * - Sends X-App-Version for API versioning
 * - Handles offline detection
 * - AbortController timeout موصول فعلياً بـ invoke (default 15s)
 * - Returns app_update_required error for status 426
 */
export async function apiClient<T = unknown>(
  functionName: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "POST", body, headers, timeout = REQUEST_TIMEOUT_MS } = options;

  // بدون اتصال — أرجع مباشرة
  if (!navigator.onLine) {
    return { data: null, error: "أنت غير متصل بالإنترنت", status: 0 };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      method,
      // مرّر الـ object مباشرة — SDK يقوم بالـ stringify ويضبط Content-Type تلقائياً.
      body,
      headers: {
        "X-App-Version": APP_VERSION,
        ...headers,
      },
      // الإصلاح الجوهري: ربط الـ signal لتفعيل الـ timeout فعلياً.
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (error) {
      const { status, message } = await extractErrorDetails(error);

      // 426 = الـ API يطلب تحديث التطبيق
      if (status === 426) {
        window.dispatchEvent(new CustomEvent("app-update-required"));
        return { data: null, error: "app_update_required", status: 426 };
      }

      return { data: (data as T) ?? null, error: message, status };
    }

    return { data: data as T, error: null, status: 200 };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      return { data: null, error: "انتهت مهلة الطلب. تحقق من اتصالك وحاول مرة أخرى.", status: 408 };
    }

    const { status, message } = await extractErrorDetails(err);
    return { data: null, error: message, status };
  }
}

/**
 * Shorthand helpers
 */
export const api = {
  get: <T>(fn: string, body?: Record<string, unknown>) =>
    apiClient<T>(fn, { method: "POST", body: { ...body, _method: "GET" } }),

  post: <T>(fn: string, body?: Record<string, unknown>) =>
    apiClient<T>(fn, { method: "POST", body }),

  put: <T>(fn: string, body?: Record<string, unknown>) =>
    apiClient<T>(fn, { method: "POST", body: { ...body, _method: "PUT" } }),

  delete: <T>(fn: string, body?: Record<string, unknown>) =>
    apiClient<T>(fn, { method: "POST", body: { ...body, _method: "DELETE" } }),
};
