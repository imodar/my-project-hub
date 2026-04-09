/**
 * اختبارات نظام Conflict Resolution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isConflicting } from "@/lib/conflictResolver";

describe("ConflictResolver — isConflicting", () => {
  const BASE_TIME = "2026-01-01T10:00:00.000Z"; // آخر مزامنة
  const BEFORE_SYNC = "2026-01-01T09:00:00.000Z"; // قبل المزامنة
  const AFTER_SYNC_1 = "2026-01-01T11:00:00.000Z"; // بعد المزامنة (محلي)
  const AFTER_SYNC_2 = "2026-01-01T12:00:00.000Z"; // بعد المزامنة (سيرفر)
  const CLOSE_TIME = "2026-01-01T10:01:00.000Z"; // قريب جداً من المزامنة

  it("يكتشف تعارضاً عندما يُعدَّل كلاهما بعد المزامنة", () => {
    const local = { id: "1", updated_at: AFTER_SYNC_1 };
    const server = { id: "1", updated_at: AFTER_SYNC_2 };

    expect(isConflicting(local, server, BASE_TIME)).toBe(true);
  });

  it("لا تعارض إذا لم يُعدَّل المحلي بعد المزامنة", () => {
    const local = { id: "1", updated_at: BEFORE_SYNC };
    const server = { id: "1", updated_at: AFTER_SYNC_2 };

    expect(isConflicting(local, server, BASE_TIME)).toBe(false);
  });

  it("لا تعارض إذا لم يُعدَّل السيرفر بعد المزامنة", () => {
    const local = { id: "1", updated_at: AFTER_SYNC_1 };
    const server = { id: "1", updated_at: BEFORE_SYNC };

    expect(isConflicting(local, server, BASE_TIME)).toBe(false);
  });

  it("لا تعارض إذا كان lastSyncedAt = null", () => {
    const local = { id: "1", updated_at: AFTER_SYNC_1 };
    const server = { id: "1", updated_at: AFTER_SYNC_2 };

    expect(isConflicting(local, server, null)).toBe(false);
  });

  it("لا تعارض إذا كان الفارق أقل من الحد الأدنى (5 دقائق)", () => {
    // كلاهما تعدّل بعد المزامنة لكن بفارق أقل من 5 دقائق
    // AFTER_SYNC_1 = 11:00، وهذا عند +1 دقيقة = 11:01
    const AFTER_SYNC_CLOSE = "2026-01-01T11:01:00.000Z"; // فارق 1 دقيقة عن AFTER_SYNC_1

    const local = { id: "1", updated_at: AFTER_SYNC_1 };
    const server = { id: "1", updated_at: AFTER_SYNC_CLOSE };

    // كلاهما بعد المزامنة، لكن الفارق 1 دقيقة < 5 دقائق (THRESHOLD)
    expect(isConflicting(local, server, BASE_TIME)).toBe(false);
  });

  it("يتعامل مع سجلات بدون updated_at", () => {
    const local = { id: "1" }; // بدون updated_at
    const server = { id: "1", updated_at: AFTER_SYNC_2 };

    // local لم يُعدَّل بعد المزامنة (0 < sync time)
    expect(isConflicting(local, server, BASE_TIME)).toBe(false);
  });
});
