import { useAdminSubscriptions } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const COLORS = ["hsl(215, 70%, 50%)", "hsl(145, 45%, 40%)", "hsl(30, 80%, 50%)", "hsl(350, 55%, 50%)"];

export default function AdminSubscriptions() {
  const { data, isLoading } = useAdminSubscriptions();
  const d = data?.data || {};
  const breakdown = d.breakdown || [];
  const events = d.recent_events || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <Card>
          <CardHeader><CardTitle>توزيع الاشتراكات</CardTitle></CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {isLoading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={100} label={({ plan, count }) => `${plan}: ${count}`}>
                    {breakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader><CardTitle>ملخص سريع</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>إجمالي المشتركين (مدفوع)</span>
                  <strong>{d.paid_count || 0}</strong>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>إجمالي المجاني</span>
                  <strong>{d.free_count || 0}</strong>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span>إجمالي الإيرادات</span>
                  <strong>{d.total_revenue || 0} SAR</strong>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader><CardTitle>آخر أحداث الاشتراكات</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الخطة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell><Badge variant="outline">{e.event_type}</Badge></TableCell>
                      <TableCell>{e.plan || "—"}</TableCell>
                      <TableCell>{e.amount ? `${e.amount} ${e.currency}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(e.created_at), "dd MMM yyyy HH:mm", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد أحداث</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
