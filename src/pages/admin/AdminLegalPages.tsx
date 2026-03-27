import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, FileText, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface LegalPage {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  content_ar: string;
  content_en: string;
  last_updated_at: string;
}

export default function AdminLegalPages() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<LegalPage | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("legal_pages" as any)
      .select("*")
      .order("slug");
    if (data) setPages(data as any);
    setLoading(false);
  };

  const handleSave = async (page: LegalPage) => {
    setSaving(page.id);
    const { error } = await supabase
      .from("legal_pages" as any)
      .update({
        title_ar: page.title_ar,
        title_en: page.title_en,
        content_ar: page.content_ar,
        content_en: page.content_en,
        last_updated_at: new Date().toISOString(),
      } as any)
      .eq("id", page.id);

    if (error) {
      toast.error("فشل الحفظ: " + error.message);
    } else {
      toast.success("تم الحفظ بنجاح ✓");
      await loadPages();
      setEditingPage(null);
    }
    setSaving(null);
  };

  const slugLabels: Record<string, string> = {
    "privacy-policy": "سياسة الخصوصية",
    "terms-of-service": "الشروط والأحكام",
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (editingPage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            تعديل: {slugLabels[editingPage.slug] || editingPage.slug}
          </h2>
          <Button variant="outline" onClick={() => setEditingPage(null)}>
            رجوع
          </Button>
        </div>

        <Tabs defaultValue="ar" dir="rtl">
          <TabsList className="mb-4">
            <TabsTrigger value="ar">العربية</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
          </TabsList>

          <TabsContent value="ar" className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                العنوان (عربي)
              </label>
              <Input
                value={editingPage.title_ar}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, title_ar: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                المحتوى (HTML عربي)
              </label>
              <textarea
                value={editingPage.content_ar}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, content_ar: e.target.value })
                }
                className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-background text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                dir="rtl"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewHtml(editingPage.content_ar)}
              className="gap-2"
            >
              <Eye size={16} /> معاينة
            </Button>
          </TabsContent>

          <TabsContent value="en" className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                Title (English)
              </label>
              <Input
                value={editingPage.title_en}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, title_en: e.target.value })
                }
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                Content (HTML English)
              </label>
              <textarea
                value={editingPage.content_en}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, content_en: e.target.value })
                }
                className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-background text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                dir="ltr"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewHtml(editingPage.content_en)}
              className="gap-2"
            >
              <Eye size={16} /> Preview
            </Button>
          </TabsContent>
        </Tabs>

        {/* Preview modal */}
        {previewHtml && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">معاينة</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>
                إغلاق
              </Button>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </CardContent>
          </Card>
        )}

        <Button
          onClick={() => handleSave(editingPage)}
          disabled={saving === editingPage.id}
          className="gap-2"
        >
          <Save size={16} />
          {saving === editingPage.id ? "جاري الحفظ..." : "حفظ التعديلات"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">الصفحات القانونية</h2>
      <p className="text-sm text-muted-foreground">
        إدارة محتوى سياسة الخصوصية والشروط والأحكام. يدعم المحتوى HTML بسيط (عناوين، قوائم، نص عريض/مائل).
      </p>

      <div className="grid gap-4">
        {pages.map((page) => (
          <Card key={page.id}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {slugLabels[page.slug] || page.slug}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    آخر تحديث:{" "}
                    {format(new Date(page.last_updated_at), "yyyy/MM/dd HH:mm")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPage({ ...page })}
              >
                تعديل
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
