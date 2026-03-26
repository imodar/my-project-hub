/**
 * Centralized error reporting service.
 *
 * Integrates with Sentry when VITE_SENTRY_DSN is set.
 * Falls back to console.error otherwise.
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
 * If VITE_SENTRY_DSN is not set, Sentry stays inactive and reportError falls back to console.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.info("[Sentry] VITE_SENTRY_DSN not set — using console.error fallback");
    return;
  }
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
    environment: import.meta.env.MODE || "production",
    enabled: import.meta.env.PROD,
  });
  sentryInitialized = true;
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
