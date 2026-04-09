/**
 * useVirtualList — Virtual Scrolling للقوائم الطويلة
 *
 * يمنع إبطاء الواجهة عند عرض مئات أو آلاف العناصر
 * بتصيير العناصر المرئية فقط في الـ DOM.
 *
 * @example
 * const { parentRef, virtualItems, totalHeight } = useVirtualList({
 *   count: items.length,
 *   estimateSize: () => 72,
 * })
 *
 * // في الـ JSX:
 * <div ref={parentRef} className="overflow-y-auto h-full">
 *   <div style={{ height: totalHeight, position: 'relative' }}>
 *     {virtualItems.map(vItem => (
 *       <div
 *         key={vItem.key}
 *         style={{ position: 'absolute', top: 0, transform: `translateY(${vItem.start}px)`, width: '100%' }}
 *       >
 *         <ItemComponent item={items[vItem.index]} />
 *       </div>
 *     ))}
 *   </div>
 * </div>
 */
import { useRef } from "react";
import { useVirtualizer, type VirtualizerOptions } from "@tanstack/react-virtual";

type UseVirtualListOptions = Omit<
  VirtualizerOptions<HTMLDivElement, Element>,
  "getScrollElement"
> & {
  /** الحد الأدنى للعناصر لتفعيل الـ virtualization (افتراضي: 50) */
  threshold?: number;
};

export function useVirtualList({
  threshold = 50,
  ...options
}: UseVirtualListOptions) {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = options.count >= threshold;

  const virtualizer = useVirtualizer({
    ...options,
    getScrollElement: () => parentRef.current,
    // overscan: عدد العناصر الإضافية المُصيَّرة خارج النافذة المرئية
    overscan: options.overscan ?? 5,
  });

  if (!shouldVirtualize) {
    // إذا كانت العناصر أقل من الحد — لا داعي للـ virtualization
    return {
      parentRef,
      virtualItems: Array.from({ length: options.count }, (_, i) => ({
        key: i,
        index: i,
        start: 0,
        size: typeof options.estimateSize === "function"
          ? options.estimateSize(i)
          : 72,
      })),
      totalHeight: "auto" as const,
      isVirtualized: false,
    };
  }

  return {
    parentRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
    isVirtualized: true,
    measureElement: virtualizer.measureElement,
  };
}
