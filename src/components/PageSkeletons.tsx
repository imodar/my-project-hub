import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton loader for list-based pages (Tasks, Market, Budget, etc.) */
export const ListPageSkeleton = () => (
  <div className="px-4 py-4 space-y-3" dir="rtl">
    {/* Header area skeleton */}
    <div className="flex items-center justify-between py-2">
      <div className="flex gap-3">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24 rounded" />
    </div>
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
