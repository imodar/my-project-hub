/**
 * اختبارات Sync Queue
 *
 * يتحقق من:
 * - إضافة عمليات للطابور
 * - منع التكرار بـ idempotency_key
 * - تحديث حالة العمليات
 * - دالة retryFailedItems
 * - getQueueSummary
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// ── Mocks using vi.hoisted لتجنب مشكلة hoisting ─────────────
const { mockItems, mockTable, nextIdRef } = vi.hoisted(() => {
  const mockItems: Record<number, any> = {};
  const nextIdRef = { value: 1 };

  const mockTable = {
    add: vi.fn(async (item: any) => {
      const id = nextIdRef.value++;
      mockItems[id] = { ...item, id };
      return id;
    }),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn(async () => null),
        count: vi.fn(async () =>
          Object.values(mockItems).filter((i: any) => i.status === "pending").length
        ),
        toArray: vi.fn(async () =>
          Object.values(mockItems).filter((i: any) => i.status === "failed")
        ),
        modify: vi.fn(async (changes: any) => {
          Object.values(mockItems).forEach((item: any) => {
            if (item.status === "failed") Object.assign(item, changes);
          });
        }),
      })),
      sortBy: vi.fn(async () =>
        Object.values(mockItems).filter((i: any) => i.status === "pending")
      ),
    })),
    update: vi.fn(async (id: number, changes: any) => {
      if (mockItems[id]) Object.assign(mockItems[id], changes);
    }),
  };

  return { mockItems, mockTable, nextIdRef };
});

vi.mock("@/lib/db", () => ({
  db: {
    sync_queue: mockTable,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}));

vi.mock("@/lib/api", () => ({
  apiClient: vi.fn(),
}));

// استيراد بعد الـ mocks
import { addToQueue, getPendingCount, getFailedCount, retryFailedItems, getQueueSummary } from "@/lib/syncQueue";

// ── Tests ─────────────────────────────────────────────────────

describe("SyncQueue", () => {
  beforeEach(() => {
    // تصفير البيانات
    Object.keys(mockItems).forEach((k) => delete mockItems[Number(k)]);
    nextIdRef.value = 1;
    vi.clearAllMocks();

    // إعداد navigator.onLine = false لتجنب processQueue
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });
  });

  it("يضيف عملية INSERT للطابور بنجاح", async () => {
    const id = await addToQueue("task_items", "INSERT", {
      id: "task-1",
      title: "مهمة اختبار",
    });

    expect(id).toBeGreaterThan(0);
    expect(mockTable.add).toHaveBeenCalledOnce();

    const call = (mockTable.add as Mock).mock.calls[0][0];
    expect(call.table).toBe("task_items");
    expect(call.operation).toBe("INSERT");
    expect(call.status).toBe("pending");
    expect(call.retries).toBe(0);
    expect(call.idempotency_key).toBeDefined();
    expect(typeof call.idempotency_key).toBe("string");
  });

  it("يمنع إضافة عملية مكررة بنفس idempotency_key", async () => {
    const key = "unique-key-123";

    // تعديل الـ mock ليُرجع سجلاً موجوداً في المحاولة الثانية
    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        first: vi.fn(async () => null), // أول مرة: لا يوجد
      })),
    } as any);

    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        first: vi.fn(async () => ({ id: 1, idempotency_key: key })), // ثاني مرة: موجود
      })),
    } as any);

    await addToQueue("task_items", "INSERT", { id: "task-1" }, key);
    const id2 = await addToQueue("task_items", "INSERT", { id: "task-1" }, key);

    // يجب أن يُرجع الـ id الموجود دون إضافة جديدة
    expect(id2).toBe(1);
    expect(mockTable.add).toHaveBeenCalledOnce(); // استُدعي مرة واحدة فقط
  });

  it("يُنشئ idempotency_key تلقائياً إذا لم يُوفَّر", async () => {
    await addToQueue("budgets", "UPDATE", { id: "budget-1", amount: 5000 });

    const call = (mockTable.add as Mock).mock.calls[0][0];
    expect(call.idempotency_key).toBeTruthy();
    expect(call.idempotency_key.length).toBeGreaterThan(8);
  });

  it("يُرجع عدد العمليات المعلقة بشكل صحيح", async () => {
    // إعداد mock مخصص لـ getPendingCount
    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        count: vi.fn(async () => 3),
      })),
    } as any);

    const count = await getPendingCount();
    expect(count).toBe(3);
  });

  it("يُرجع عدد العمليات الفاشلة بشكل صحيح", async () => {
    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        count: vi.fn(async () => 2),
      })),
    } as any);

    const count = await getFailedCount();
    expect(count).toBe(2);
  });

  it("retryFailedItems يُعيد تعيين الفاشلة لـ pending", async () => {
    const failedItems = [
      { id: 1, status: "failed", table: "tasks", operation: "INSERT" },
      { id: 2, status: "failed", table: "budgets", operation: "UPDATE" },
    ];

    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(async () => failedItems),
        modify: vi.fn(async () => {}),
      })),
    } as any);

    const count = await retryFailedItems();
    expect(count).toBe(2);
  });

  it("retryFailedItems يُرجع 0 إذا لا توجد فاشلة", async () => {
    (mockTable.where as Mock).mockReturnValueOnce({
      equals: vi.fn(() => ({
        toArray: vi.fn(async () => []),
        modify: vi.fn(async () => {}),
      })),
    } as any);

    const count = await retryFailedItems();
    expect(count).toBe(0);
  });

  it("getQueueSummary يُرجع إحصائيات صحيحة", async () => {
    (mockTable.where as Mock)
      .mockReturnValueOnce({
        equals: vi.fn(() => ({ count: vi.fn(async () => 5) })),
      } as any)
      .mockReturnValueOnce({
        equals: vi.fn(() => ({ count: vi.fn(async () => 2) })),
      } as any)
      .mockReturnValueOnce({
        equals: vi.fn(() => ({ count: vi.fn(async () => 10) })),
      } as any);

    const summary = await getQueueSummary();
    expect(summary).toEqual({ pending: 5, failed: 2, synced: 10 });
  });
});
