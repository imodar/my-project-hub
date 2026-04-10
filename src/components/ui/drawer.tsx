import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Root> & { shouldScaleBackground?: boolean }
>(({ shouldScaleBackground = true, ...props }, _ref) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
));
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // With windowSoftInputMode="adjustResize" (capacitor.config.ts),
    // window.innerHeight shrinks when the keyboard opens, so we only need
    // to update maxHeight. We never touch `bottom` — Vaul controls that.
    const onWindowResize = () => {
      el.style.maxHeight = `${Math.floor(window.innerHeight * 0.9)}px`;
    };

    window.addEventListener("resize", onWindowResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (contentRef.current) contentRef.current.style.maxHeight = "";
    };
  }, []);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[90dvh] flex-col rounded-t-[10px] border bg-background transition-[max-height] duration-150 ease-out",
          className,
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("grid gap-1.5 p-4 text-right shrink-0", className)} {...props} />
));
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-auto flex flex-col gap-2 p-4 shrink-0", className)} {...props} />
));
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
