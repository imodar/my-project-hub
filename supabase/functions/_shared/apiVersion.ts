/**
 * فحص إصدار التطبيق — API Version Guard
 *
 * يفحص X-App-Version header ويُرجع 426 إذا كان الإصدار قديماً جداً.
 * يُمكّن من إجبار المستخدمين على تحديث التطبيق.
 *
 * @example
 * import { checkAppVersion } from "../_shared/apiVersion.ts";
 *
 * const versionError = checkAppVersion(request);
 * if (versionError) return versionError;
 */

/** الحد الأدنى المدعوم — حدّث هذا عند إصدار تغييرات breaking */
const MIN_SUPPORTED_VERSION = "1.0.0";

/**
 * يُقارن إصدارَين بصيغة semver (major.minor.patch).
 * يُرجع سالب إذا كان v1 أصغر، صفر إذا متساويان، موجب إذا أكبر.
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (parts1[i] ?? 0) - (parts2[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * يفحص إصدار التطبيق المُرسَل مع الطلب.
 *
 * @returns Response بـ 426 إذا كان الإصدار غير مدعوم، null إذا مقبول
 */
export function checkAppVersion(request: Request): Response | null {
  const clientVersion = request.headers.get("X-App-Version");

  // إذا لم يُرسَل الـ header — اسمح بالمرور (backward compatibility)
  if (!clientVersion) return null;

  try {
    if (compareVersions(clientVersion, MIN_SUPPORTED_VERSION) < 0) {
      return new Response(
        JSON.stringify({
          error: "app_update_required",
          message: "إصدار التطبيق قديم. الرجاء التحديث للاستمرار.",
          min_version: MIN_SUPPORTED_VERSION,
          current_version: clientVersion,
        }),
        {
          status: 426,
          headers: {
            "Content-Type": "application/json",
            "X-Min-App-Version": MIN_SUPPORTED_VERSION,
          },
        }
      );
    }
  } catch {
    // إصدار غير صالح — اسمح بالمرور
    return null;
  }

  return null;
}
