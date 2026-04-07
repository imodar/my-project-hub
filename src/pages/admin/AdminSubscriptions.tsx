import { useState } from "react";
import { useAdminSubscriptions, useAdminMutations, useAdminUserSubscription } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Search, ShieldCheck, ShieldOff, User } from "lucide-react";

const COLORS = ["hsl(215, 70%, 50%)", "hsl(145, 45%, 40%)", "hsl(30, 80%, 50%)", "hsl(350, 55%, 50%)"];

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني",
  monthly: "شهري",
  yearly: "سنوي",
  family: "عائلة",
};

const EVENT_LABELS: Record<string, string> = {
  initial_purchase: "شراء جديد",
  renewal: "تجديد",
  cancellation: "إلغاء",
  expiration: "انتهاء",
  billing_issue: "مشكلة دفع",
  admin_grant: "منح يدوي",
  admin_revoke: "سحب يدوي",
  product_change: "تغيير الباقة",
};

function ManageUserSubscription() {
  const [userId, setUserId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [plan, setPlan] = useState("yearly");
  const [rcCustomerId, setRcCustomerId] = useState("");

  const { data, isLoading, error } = useAdminUserSubscription(searchId);
  const { grantSubscription, revokeSubscription, syncRevenueCatCustomer } = useAdminMutations();

  const userProfile = data?.data?.profile;
  const userEvents = data?.data?.events || [];

  const handleSearch = () => {
    if (userId.trim().length > 10) setSearchId(userId.trim());
  };

  const handleGrant = () => {
    if (!searchId) return;
    grantSubscription.mutate({ target_user_id: searchId, plan, expires_at: expiresAt || undefined });
  };

  const handleRevoke = () => {
    if (!searchId) return;
    revokeSubscription.mutate({ target_user_id: searchId });
  };

  const handleSyncRc = () => {
    if (!searchId || !rcCustomerId.trim()) return;
    syncRevenueCatCustomer.mutate({ target_user_id: searchId, revenuecat_customer_id: rcCustomerId.trim() });
  };

  const isPending = grantSubscription.isPending || revokeSubscription.isPending || syncRevenueCatCustomer.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User size={18} />
          إدارة اشتراك مستخدم
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User ID search */}
        <div className="flex gap-2">
          <Input
            placeholder="أدخل User ID (UUID)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="font-mono text-sm"
            dir="ltr"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search size={16} />
          </Button>
        </div>

        {/* User details */}
        {isLoading && <Skeleton className="h-24 w-full" />}
        {error && <p className="text-sm text-destructive">مستخدم غير موجود</p>}
        {userProfile && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{userProfile.name || "—"}</p>
                <p className="text-sm text-muted-foreground font-mono">{userProfile.id}</p>
                {userProfile.phone && <p className="text-sm text-muted-foreground">{userProfile.phone}</p>}
              </div>
              <Badge variant={userProfile.subscription_plan === "free" ? "secondary" : "default"}>
                {PLAN_LABELS[userProfile.subscription_plan] || userProfile.subscription_plan}
              </Badge>
            </div>

            {userProfile.subscription_expires_at && (
              <p className="text-sm text-muted-foreground">
                ينتهي: {format(new Date(userProfile.subscription_expires_at), "dd MMM yyyy", { locale: ar })}
              </p>
            )}

            {userProfile.revenuecat_customer_id && (
              <p className="text-xs text-muted-foreground font-mono break-all">
                RC ID: {userProfile.revenuecat_customer_id}
              </p>
            )}

            {/* Grant subscription */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground">منح اشتراك يدوي</p>
              <div className="flex gap-2">
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="yearly">سنوي</option>
                  <option value="monthly">شهري</option>
                  <option value="family">عائلة</option>
                </select>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="تاريخ الانتهاء"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleGrant}
                  disabled={isPending}
                >
                  <ShieldCheck size={14} className="mr-1" />
                  منح الاشتراك
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={handleRevoke}
                  disabled={isPending || userProfile.subscription_plan === "free"}
                >
                  <ShieldOff size={14} className="mr-1" />
                  سحب الاشتراك
                </Button>
              </div>
            </div>

            {/* Sync RevenueCat Customer ID */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground">ربط RevenueCat Customer ID</p>
              <div className="flex gap-2">
                <Input
                  placeholder="RevenueCat Customer ID"
                  value={rcCustomerId}
                  onChange={(e) => setRcCustomerId(e.target.value)}
                  className="font-mono text-xs"
                  dir="ltr"
                />
                <Button size="sm" variant="outline" onClick={handleSyncRc} disabled={isPending || !rcCustomerId.trim()}>
                  ربط
                </Button>
              </div>
            </div>

            {/* Recent events for this user */}
            {userEvents.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">سجل الاشتراكات</p>
                <div className="space-y-1">
                  {userEvents.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yy HH:mm", { locale: ar })}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {EVENT_LABELS[e.event_type] || e.event_type}
                      </Badge>
                      {e.amount > 0 && (
                        <span className="font-medium">{e.amount} {e.currency}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
                  <Pie data={breakdown} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={100} label={({ plan, count }) => `${PLAN_LABELS[plan] || plan}: ${count}`}>
                    {breakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, PLAN_LABELS[n as string] || n]} />
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

      {/* Manual subscription management */}
      <ManageUserSubscription />

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
                      <TableCell><Badge variant="outline">{EVENT_LABELS[e.event_type] || e.event_type}</Badge></TableCell>
                      <TableCell>{PLAN_LABELS[e.plan] || e.plan || "—"}</TableCell>
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
