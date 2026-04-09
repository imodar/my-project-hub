/**
 * اختبارات API Client
 *
 * يتحقق من:
 * - إرجاع خطأ offline عندما لا يوجد اتصال
 * - إرسال X-App-Version header
 * - معالجة app_update_required (426)
 * - استخراج HTTP status من رسائل الخطأ
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted لتجنب مشكلة hoisting في vi.mock
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { apiClient, APP_VERSION } from "@/lib/api";

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // افتراضي: متصل
    Object.defineProperty(navigator, "onLine", { writable: true, value: true });
  });

  it("يُرجع خطأ offline فوراً عندما لا يوجد اتصال", async () => {
    Object.defineProperty(navigator, "onLine", { value: false });

    const result = await apiClient("tasks-api", { body: { action: "get-lists" } });

    expect(result.status).toBe(0);
    expect(result.error).toContain("غير متصل");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("يُرسل X-App-Version header في كل طلب", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { items: [] }, error: null });

    await apiClient("tasks-api", { body: { action: "get-lists" } });

    const invokeArgs = mockInvoke.mock.calls[0][1];
    expect(invokeArgs.headers["X-App-Version"]).toBe(APP_VERSION);
  });

  it("يُرجع data وstatus=200 عند النجاح", async () => {
    const mockData = { lists: [{ id: "1", title: "قائمة المهام" }] };
    mockInvoke.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await apiClient("tasks-api");

    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
    expect(result.status).toBe(200);
  });

  it("يُعالج خطأ 426 كـ app_update_required", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge Function returned a non-2xx status code: 426" },
    });

    const result = await apiClient("tasks-api");

    expect(result.status).toBe(426);
    expect(result.error).toBe("app_update_required");
  });

  it("يستخرج HTTP status من رسالة الخطأ", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge Function returned a non-2xx status code: 503" },
    });

    const result = await apiClient("tasks-api");

    expect(result.status).toBe(503);
  });

  it("يُرجع status=500 لأخطاء غير متوقعة", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Unexpected error without status code" },
    });

    const result = await apiClient("tasks-api");

    expect(result.status).toBe(500);
  });

  it("يُعالج exceptions في الشبكة", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Network failure"));

    const result = await apiClient("tasks-api");

    expect(result.error).toBe("Network failure");
    expect(result.status).toBe(500);
    expect(result.data).toBeNull();
  });
});
