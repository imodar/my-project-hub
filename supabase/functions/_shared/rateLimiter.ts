/**
 * Rate Limiter — حد معدل الطلبات للـ Edge Functions
 *
 * يستخدم خوارزمية Sliding Window في ذاكرة Deno (في العملية الواحدة).
 * للحماية من DDoS والإساءة في استخدام الـ API.
 *
 * ملاحظة: هذا in-memory limiter داخل كل Edge Function instance.
 * للحماية الكاملة على نطاق Distributed يجب استخدام Upstash Redis.
 *
 * كيفية الاستخدام:
 * ```ts
 * import { checkRateLimit } from "../_shared/rateLimiter.ts";
 *
 * // في بداية كل Edge Function handler:
 * const rateLimitResponse = checkRateLimit(userId, "tasks-api");
 * if (rateLimitResponse) return rateLimitResponse;
 * ```
 */

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

// الذاكرة المشتركة داخل العملية
const store = new Map<string, RateLimitRecord>();

// إعدادات افتراضية
const DEFAULT_CONFIG = {
  /** أقصى عدد طلبات في النافذة الزمنية */
  maxRequests: 120,
  /** مدة النافذة الزمنية بالثواني */
  windowSeconds: 60,
};

/**
 * تفحص ما إذا كان المستخدم تجاوز حد الطلبات.
 *
 * @param userId - معرّف المستخدم أو IP
 * @param endpoint - اسم الـ endpoint للتتبع (لا يؤثر على الحساب)
 * @param config - إعدادات مخصصة (اختياري)
 * @returns Response بـ 429 إذا تجاوز الحد، null إذا مسموح
 */
export function checkRateLimit(
  userId: string,
  endpoint: string = "default",
  config: { maxRequests?: number; windowSeconds?: number } = {}
): Response | null {
  const { maxRequests, windowSeconds } = { ...DEFAULT_CONFIG, ...config };
  const key = `${endpoint}:${userId}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const record = store.get(key);

  if (!record || now - record.windowStart > windowMs) {
    // نافذة جديدة
    store.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);
    return new Response(
      JSON.stringify({
        error: "too_many_requests",
        message: "لقد تجاوزت الحد المسموح من الطلبات. الرجاء الانتظار قليلاً.",
        retry_after: retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((record.windowStart + windowMs) / 1000)),
        },
      }
    );
  }

  record.count++;
  return null;
}

/**
 * تنظيف الـ store من المفاتيح المنتهية الصلاحية.
 * يُستدعى اختيارياً في background لمنع تراكم الذاكرة.
 */
export function cleanupExpiredEntries(windowSeconds = DEFAULT_CONFIG.windowSeconds): void {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  for (const [key, record] of store.entries()) {
    if (now - record.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}
