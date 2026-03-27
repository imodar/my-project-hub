/**
 * Preload critical page chunks after initial render
 * so navigating to them doesn't cause a white flash.
 */

const CRITICAL_PAGES = [
  () => import("@/pages/Market.tsx"),
  () => import("@/pages/Tasks.tsx"),
  () => import("@/pages/Chat.tsx"),
  () => import("@/pages/Map.tsx"),
  () => import("@/pages/Settings.tsx"),
  () => import("@/pages/Calendar.tsx"),
  () => import("@/pages/Budget.tsx"),
  () => import("@/pages/Documents.tsx"),
  () => import("@/pages/Trips.tsx"),
  () => import("@/pages/Albums.tsx"),
  () => import("@/pages/Debts.tsx"),
  () => import("@/pages/Places.tsx"),
  () => import("@/pages/Vehicle.tsx"),
  () => import("@/pages/Medications.tsx"),
  () => import("@/pages/Vaccinations.tsx"),
  () => import("@/pages/KidsWorship.tsx"),
  () => import("@/pages/Profile.tsx"),
  () => import("@/pages/Trash.tsx"),
  () => import("@/pages/Athkar.tsx"),
  () => import("@/pages/Tasbih.tsx"),
];

let preloaded = false;

export function preloadCriticalPages() {
  if (preloaded) return;
  preloaded = true;

  // Use requestIdleCallback to avoid blocking the main thread
  const load = () => {
    // Load pages sequentially with small delays to not saturate the network
    let i = 0;
    const next = () => {
      if (i >= CRITICAL_PAGES.length) return;
      CRITICAL_PAGES[i]().catch(() => {});
      i++;
      setTimeout(next, 100);
    };
    next();
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(load, { timeout: 3000 });
  } else {
    setTimeout(load, 2000);
  }
}
