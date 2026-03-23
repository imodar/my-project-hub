import { useState } from "react";
import { useAdminAuditLog } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const actionLabels: Record<string, string> = {
  suspend_user: "تعليق مستخدم",
  unsuspend_user: "إلغاء تعليق",
  update_setting: "تحديث إعداد",
  add_version: "إصدار جديد",
  send_broadcast: "إشعار جماعي",
};

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAuditLog(page);
  const logs = data?.data || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>سجل التدقيق</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الإجراء</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الهدف</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell><Badge>{actionLabels[l.action] || l.action}</Badge></TableCell>
                      <TableCell className="text-sm">{l.target_type || "—"}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[120px] truncate">{l.target_id || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{l.details ? JSON.stringify(l.details) : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(l.created_at), "dd MMM HH:mm", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="text-sm">صفحة {page}</span>
            <Button variant="outline" size="sm" disabled={logs.length < 50} onClick={() => setPage(p => p + 1)}><ChevronLeft className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
