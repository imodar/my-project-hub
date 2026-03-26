/**
 * Centralized error reporting service.
 *
 * Currently logs to console. To integrate Sentry (or any service):
 * 1. npm install @sentry/react
 * 2. Call Sentry.init({ dsn: "..." }) in main.tsx
 * 3. Replace the body of `reportError` with Sentry.captureException(error, { extra: context })
 *
 * All Error Boundaries and global handlers funnel through this module,
 * so a single change here enables production monitoring everywhere.
 */

interface ErrorContext {
  /** Component or route where the error occurred */
  source?: string;
  /** React componentStack from ErrorInfo */
  componentStack?: string;
  /** Arbitrary metadata */
  [key: string]: unknown;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  // --- Sentry integration point ---
  // import * as Sentry from "@sentry/react";
  // Sentry.captureException(error, { extra: context });

  console.error(`[ErrorReport] ${context?.source || "unknown"}:`, error, context);
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
