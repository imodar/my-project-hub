import { useAdminSecurity } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Key, FileCheck, Download } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminSecurity() {
  const { data, isLoading } = useAdminSecurity();
  const d = data?.data || {};

  const stats = [
    { icon: Key, label: "أكواد OTP اليوم", value: d.otp_today || 0, color: "bg-amber-500" },
    { icon: Shield, label: "سجلات الموافقات", value: d.consent_count || 0, color: "bg-blue-500" },
    { icon: Download, label: "طلبات تصدير البيانات", value: d.export_requests || 0, color: "bg-green-600" },
    { icon: FileCheck, label: "طلبات حذف الحسابات", value: d.deletion_requests || 0, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-1" /> : <p className="text-xl font-bold">{s.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent OTP */}
      <Card>
        <CardHeader><CardTitle>آخر أكواد OTP</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجوال</TableHead>
                    <TableHead>المحاولات</TableHead>
                    <TableHead>تم التحقق</TableHead>
                    <TableHead>الانتهاء</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(d.recent_otps || []).map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell dir="ltr" className="text-left font-mono">{o.phone}</TableCell>
                      <TableCell>{o.attempts}</TableCell>
                      <TableCell>{o.verified ? <Badge>نعم</Badge> : <Badge variant="secondary">لا</Badge>}</TableCell>
                      <TableCell className="text-sm">{format(new Date(o.expires_at), "HH:mm", { locale: ar })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(o.created_at), "dd MMM HH:mm", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                  {(d.recent_otps || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deletion requests */}
      <Card>
        <CardHeader><CardTitle>طلبات حذف الحسابات</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحالة</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>تاريخ الطلب</TableHead>
                    <TableHead>الحذف النهائي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(d.deletion_list || []).map((dl: any) => (
                    <TableRow key={dl.id}>
                      <TableCell><Badge variant={dl.status === "pending" ? "default" : "secondary"}>{dl.status}</Badge></TableCell>
                      <TableCell className="text-sm">{dl.reason || "—"}</TableCell>
                      <TableCell className="text-sm">{format(new Date(dl.requested_at), "dd MMM yyyy", { locale: ar })}</TableCell>
                      <TableCell className="text-sm">{format(new Date(dl.scheduled_delete_at), "dd MMM yyyy", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                  {(d.deletion_list || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
