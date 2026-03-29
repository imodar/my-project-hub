import { useState } from "react";
import { useAdminNotifications, useAdminMutations } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";
import { appToast } from "@/lib/toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminNotifications() {
  const [page, setPage] = useState(1);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data, isLoading } = useAdminNotifications(page);
  const { sendBroadcast } = useAdminMutations();
  const logs = data?.data || [];

  const handleSend = async () => {
    if (!title.trim()) return;
    try {
      await sendBroadcast.mutateAsync({ title, body });
      appToast.success("تم إرسال الإشعار الجماعي");
      setShowBroadcast(false);
      setTitle("");
      setBody("");
    } catch { appToast.error("فشل الإرسال"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">سجل التنبيهات</h2>
        <Button onClick={() => setShowBroadcast(true)} className="gap-2">
          <Send className="h-4 w-4" /> إشعار جماعي
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>المحتوى</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>عدد الفتح</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{l.body || "—"}</TableCell>
                      <TableCell className="text-sm">{l.target_type || "عام"}</TableCell>
                      <TableCell>{l.opened_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(l.sent_at), "dd MMM HH:mm", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadcast dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إرسال إشعار جماعي</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="عنوان الإشعار" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="محتوى الإشعار" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBroadcast(false)}>إلغاء</Button>
            <Button onClick={handleSend} disabled={!title.trim() || sendBroadcast.isPending}>إرسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
