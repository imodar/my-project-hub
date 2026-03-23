import { useAdminDashboard, useAdminContentStats } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Home, Activity, Calendar, ShoppingCart, FileText,
  Pill, CreditCard, MapPin, Car, MessageSquare, ListTodo,
  Wallet, BookOpen, Image, Plane
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

function StatCard({ icon: Icon, label, value, color, loading }: { icon: any; label: string; value: number | string; color: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const COLORS = ["hsl(215, 70%, 50%)", "hsl(145, 45%, 40%)", "hsl(30, 80%, 50%)", "hsl(350, 55%, 50%)", "hsl(270, 50%, 50%)", "hsl(185, 60%, 38%)"];

export default function AdminOverview() {
  const { data: dash, isLoading: dl } = useAdminDashboard();
  const { data: content, isLoading: cl } = useAdminContentStats();

  const d = dash?.data || {};
  const c = content?.data || {};

  const mainStats = [
    { icon: Users, label: "إجمالي المستخدمين", value: d.total_users || 0, color: "bg-blue-500" },
    { icon: Home, label: "العائلات", value: d.total_families || 0, color: "bg-green-600" },
    { icon: Activity, label: "نشطون اليوم", value: d.active_today || 0, color: "bg-amber-500" },
    { icon: Users, label: "مستخدمون جدد (7 أيام)", value: d.new_users_7d || 0, color: "bg-purple-500" },
  ];

  const contentStats = [
    { icon: Calendar, label: "المناسبات", value: c.events || 0, color: "bg-rose-500" },
    { icon: ListTodo, label: "المهام", value: c.tasks || 0, color: "bg-teal-600" },
    { icon: ShoppingCart, label: "قوائم التسوق", value: c.market_lists || 0, color: "bg-orange-500" },
    { icon: Pill, label: "الأدوية", value: c.medications || 0, color: "bg-pink-500" },
    { icon: Wallet, label: "الديون", value: c.debts || 0, color: "bg-indigo-500" },
    { icon: Plane, label: "الرحلات", value: c.trips || 0, color: "bg-cyan-600" },
    { icon: FileText, label: "الوثائق", value: c.documents || 0, color: "bg-slate-600" },
    { icon: Image, label: "الألبومات", value: c.albums || 0, color: "bg-violet-500" },
    { icon: Car, label: "المركبات", value: c.vehicles || 0, color: "bg-emerald-600" },
    { icon: MapPin, label: "الأماكن", value: c.places || 0, color: "bg-red-500" },
    { icon: MessageSquare, label: "رسائل الدردشة", value: c.chat_messages || 0, color: "bg-blue-600" },
    { icon: BookOpen, label: "الوصايا", value: c.wills || 0, color: "bg-amber-600" },
  ];

  const subscriptionData = d.subscription_breakdown || [];
  const featureData = (d.top_features || []).slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Main stats */}
      <div>
        <h2 className="text-xl font-bold mb-4">الإحصائيات الرئيسية</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mainStats.map((s) => (
            <StatCard key={s.label} {...s} loading={dl} />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature usage */}
        <Card>
          <CardHeader><CardTitle>أكثر الميزات استخداماً</CardTitle></CardHeader>
          <CardContent className="h-72">
            {dl ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(215, 70%, 50%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions */}
        <Card>
          <CardHeader><CardTitle>توزيع الاشتراكات</CardTitle></CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {dl ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subscriptionData} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={100} label={({ plan, count }) => `${plan}: ${count}`}>
                    {subscriptionData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content stats */}
      <div>
        <h2 className="text-xl font-bold mb-4">إحصائيات المحتوى</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {contentStats.map((s) => (
            <StatCard key={s.label} {...s} loading={cl} />
          ))}
        </div>
      </div>
    </div>
  );
}
