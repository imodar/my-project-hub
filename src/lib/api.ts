import { supabase } from "@/integrations/supabase/client";

/**
 * إصدار التطبيق — يُرسَل مع كل طلب API.
 * يسمح للـ Edge Functions بالتحقق من الحد الأدنى المدعوم
 * وإرجاع 426 Upgrade Required عند الحاجة.
 */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * Unified API client for Supabase Edge Functions.
 *
 * - Automatically includes JWT auth header
 * - Sends X-App-Version for API versioning
 * - Handles offline detection
 * - Extracts HTTP status from Supabase error messages
 * - Returns app_update_required error for status 426
 */
export async function apiClient<T = unknown>(
  functionName: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "POST", body, headers } = options;

  // بدون اتصال — أرجع مباشرة
  if (!navigator.onLine) {
    return { data: null, error: "أنت غير متصل بالإنترنت", status: 0 };
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": APP_VERSION,
        ...headers,
      },
    });

    if (error) {
      const statusMatch = error.message?.match(/(\d{3})/);
      const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 500;

      // 426 = الـ API يطلب تحديث التطبيق
      if (httpStatus === 426) {
        return { data: null, error: "app_update_required", status: 426 };
      }

      return { data: data as T, error: error.message, status: httpStatus };
    }

    return { data: data as T, error: null, status: 200 };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { data: null, error: message, status: 500 };
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
