/**
 * اختبارات useDraftPersistence hook
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useDraftPersistence", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("يُرجع hasDraft=false عندما لا توجد مسودة", () => {
    const { result } = renderHook(() => useDraftPersistence("test-form"));
    expect(result.current.hasDraft).toBe(false);
  });

  it("يحفظ المسودة بعد debounce", async () => {
    const { result } = renderHook(() => useDraftPersistence<{ name: string }>("trip-form"));

    act(() => {
      result.current.saveDraft({ name: "رحلة مكة" });
    });

    // قبل انتهاء debounce — لم يُحفظ بعد
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    // بعد debounce
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "draft:v1:trip-form",
      JSON.stringify({ name: "رحلة مكة" })
    );
  });

  it("يُحمّل المسودة المحفوظة", () => {
    const data = { title: "ميزانية رمضان", amount: 5000 };
    // إعداد localStorage ليُرجع البيانات لأي key
    localStorageMock.getItem.mockImplementation(() => JSON.stringify(data));

    const { result } = renderHook(() =>
      useDraftPersistence<typeof data>("budget-form")
    );

    const loaded = result.current.loadDraft();
    expect(loaded).toEqual(data);
  });

  it("يحذف المسودة بعد الحفظ الناجح", () => {
    const { result } = renderHook(() => useDraftPersistence("will-form"));

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("draft:v1:will-form");
  });

  it("يُرجع null إذا كانت المسودة تالفة", () => {
    // إعداد localStorage ليُرجع JSON تالفاً
    localStorageMock.getItem.mockImplementation(() => "{ invalid json }}}");

    const { result } = renderHook(() => useDraftPersistence("broken-form"));
    const loaded = result.current.loadDraft();

    expect(loaded).toBeNull();
  });

  it("يلغي debounce عند إلغاء التثبيت", () => {
    const { result, unmount } = renderHook(() =>
      useDraftPersistence<{ data: string }>("unmount-form")
    );

    act(() => {
      result.current.saveDraft({ data: "test" });
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // لا يجب حفظ أي شيء بعد unmount
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});
