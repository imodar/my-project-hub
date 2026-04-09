/**
 * Centralized error reporting service.
 *
 * Integrates with Sentry when VITE_SENTRY_DSN is set.
 * Falls back to console.error otherwise.
 *
 * PRODUCTION REQUIREMENT: VITE_SENTRY_DSN must be set before going to production.
 * Without it, errors are invisible in production and debugging is impossible.
 */
import * as Sentry from "@sentry/react";

interface ErrorContext {
  /** Component or route where the error occurred */
  source?: string;
  /** React componentStack from ErrorInfo */
  componentStack?: string;
  /** Arbitrary metadata */
  [key: string]: unknown;
}

let sentryInitialized = false;

/**
 * Initialize Sentry. Call once in main.tsx.
 *
 * - In PRODUCTION: logs a critical warning if DSN is missing (errors will be invisible).
 * - In DEVELOPMENT: silently falls back to console.error.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const isProd = import.meta.env.PROD as boolean;

  if (!dsn) {
    if (isProd) {
      // CRITICAL: In production, missing Sentry DSN means all errors are invisible.
      // This warning appears in the browser console — visible to developers in DevTools.
      console.warn(
        "%c[PRODUCTION WARNING] VITE_SENTRY_DSN is not configured!\n" +
        "All runtime errors are invisible. Set VITE_SENTRY_DSN in your deployment environment.\n" +
        "See: https://docs.sentry.io/platforms/javascript/guides/react/",
        "color: red; font-weight: bold; font-size: 14px;"
      );
    } else {
      console.info("[Sentry] VITE_SENTRY_DSN not set — using console.error fallback (dev mode)");
    }
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: isProd ? 0.2 : 1.0,
    environment: (import.meta.env.MODE as string) || "production",
    enabled: isProd,
    // تجاهل الأخطاء الشائعة غير القابلة للإصلاح
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Loading chunk \d+ failed/,
      /^Failed to fetch dynamically imported module/,
    ],
  });
  sentryInitialized = true;
  console.info("[Sentry] Initialized successfully ✅");
}

export function reportError(error: unknown, context?: ErrorContext): void {
  if (sentryInitialized) {
    Sentry.captureException(error, { extra: context });
  }
  console.error(`[ErrorReport] ${context?.source || "unknown"}:`, error, context);
}

/**
 * Set the current user for Sentry context.
 * Call with { id, email } on login, or null on logout.
 */
export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (sentryInitialized) {
    Sentry.setUser(user);
  }
}

/**
 * Install global listeners for unhandled errors & promise rejections.
 * Call once in main.tsx.
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
