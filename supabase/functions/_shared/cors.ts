/**
 * CORS Headers المشتركة للـ Edge Functions
 *
 * تُقيّد الوصول للـ origins المسموح بها فقط.
 * تُستخدم في جميع الـ Edge Functions.
 */

const ALLOWED_ORIGINS = [
  "https://ptmhrfovbyvpewfdpejf.supabase.co",
  "https://your-production-domain.com", // TODO: استبدل بالدومين الإنتاجي
  // تطوير محلي
  "http://localhost:8080",
  "http://localhost:3000",
];

/**
 * يُرجع CORS headers المناسبة بناءً على الـ origin.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // fallback للـ production domain

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "Authorization",
      "X-App-Version",
      "apikey",
    ].join(", "),
    "Access-Control-Max-Age": "86400",
    // Security headers إضافية
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

/**
 * يُعالج preflight OPTIONS request.
 */
export function handleCorsOptions(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
}
