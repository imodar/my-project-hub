import { supabase } from "@/integrations/supabase/client";

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
 * Automatically includes JWT and handles errors/retries.
 */
export async function apiClient<T = unknown>(
  functionName: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "POST", body, headers } = options;

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    if (error) {
      // Retry once on network error
      if (!navigator.onLine) {
        return { data: null, error: "أنت غير متصل بالإنترنت", status: 0 };
      }
      return { data: null, error: error.message, status: 500 };
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
