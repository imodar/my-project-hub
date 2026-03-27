import { Skeleton } from "@/components/ui/skeleton";

/** Persistent header shell matching PageHeader gradient — appears instantly */
const HeaderShell = () => (
  <div
    className="sticky top-0 z-50 px-4 pt-12 pb-3 rounded-b-3xl"
    style={{
      background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
    }}
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }} />
      <Skeleton className="h-5 w-28 rounded bg-white/20" />
    </div>
  </div>
);

/** Skeleton loader for list-based pages (Tasks, Market, Budget, etc.) */
export const ListPageSkeleton = () => (
  <div dir="rtl">
    <HeaderShell />
    <div className="px-4 py-4 space-y-3">
      {/* Search skeleton */}
      <Skeleton className="h-10 rounded-xl" />
      {/* Tabs / categories skeleton */}
      <div className="flex gap-2 overflow-hidden py-1">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
      {/* Card items skeleton */}
      <div className="space-y-2 pt-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

/** Skeleton loader for calendar page */
export const CalendarPageSkeleton = () => (
  <div className="px-4 py-4 space-y-4" dir="rtl">
    {/* Month header skeleton */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-6 w-32 rounded" />
      <Skeleton className="h-5 w-5 rounded" />
    </div>
    {/* Calendar grid skeleton */}
    <div className="grid grid-cols-7 gap-1">
      {[...Array(7)].map((_, i) => (
        <Skeleton key={`h-${i}`} className="h-6 w-full rounded" />
      ))}
      {[...Array(35)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
    {/* Events skeleton */}
    <div className="space-y-2 pt-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  </div>
);

/** Skeleton loader for detail/card pages (Debts, Trips, etc.) */
export const CardPageSkeleton = () => (
  <div className="px-4 py-4 space-y-3" dir="rtl">
    {/* Summary cards skeleton */}
    <div className="flex gap-3">
      <Skeleton className="h-20 flex-1 rounded-2xl" />
      <Skeleton className="h-20 flex-1 rounded-2xl" />
    </div>
    {/* Tab bar skeleton */}
    <Skeleton className="h-10 rounded-xl" />
    {/* Card items skeleton */}
    <div className="space-y-3 pt-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  </div>
);
