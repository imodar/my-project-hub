import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface LegalPageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: "privacy-policy" | "terms-of-service";
}

export default function LegalPageSheet({ open, onOpenChange, slug }: LegalPageSheetProps) {
  const { language, dir, isRTL } = useLanguage();
  const [page, setPage] = useState<Tables<"legal_pages"> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setPage(data);
        setLoading(false);
      })
      .then(undefined, () => setLoading(false));
  }, [open, slug]);

  const title = page
    ? language === "ar" ? page.title_ar : page.title_en
    : "";
  const content = page
    ? language === "ar" ? page.content_ar : page.content_en
    : "";
  const lastUpdated = page?.last_updated_at
    ? format(new Date(page.last_updated_at), "d MMMM yyyy", {
        locale: language === "ar" ? arLocale : undefined,
      })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl p-0 border-none"
        style={{ direction: dir }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle
              className={`text-foreground text-lg font-bold ${isRTL ? "text-right" : "text-left"}`}
            >
              {loading ? <Skeleton className="h-6 w-40" /> : title}
            </SheetTitle>
            {!loading && lastUpdated && (
              <p className={`text-xs text-muted-foreground mt-1 ${isRTL ? "text-right" : "text-left"}`}>
                {language === "ar" ? "آخر تحديث:" : "Last updated:"} {lastUpdated}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-1/2 mt-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none text-foreground
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3
                  prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-3
                  prose-li:text-muted-foreground prose-li:leading-relaxed
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-ul:my-2 prose-ul:list-disc prose-ul:ps-5
                  dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
