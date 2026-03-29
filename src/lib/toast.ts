// ── Unified App Toast System ──

export type ToastType = "success" | "error" | "warning" | "info";

export interface AppToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

type Listener = (toasts: AppToastItem[]) => void;

let toasts: AppToastItem[] = [];
const listeners: Listener[] = [];
let counter = 0;

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function add(type: ToastType, title: string, description?: string) {
  const id = String(++counter);
  toasts = [{ id, type, title, description }, ...toasts].slice(0, 3);
  notify();

  setTimeout(() => dismiss(id), 3500);

  return id;
}

export const appToast = {
  success: (title: string, description?: string) => add("success", title, description),
  error: (title: string, description?: string) => add("error", title, description),
  warning: (title: string, description?: string) => add("warning", title, description),
  info: (title: string, description?: string) => add("info", title, description),
  dismiss,
};

/** Subscribe to toast state — returns unsubscribe fn */
export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export function getToasts(): AppToastItem[] {
  return toasts;
}
