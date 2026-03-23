import { useAdminContentStats } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Calendar, ShoppingCart, FileText, Pill, Wallet, MapPin,
  Car, MessageSquare, ListTodo, BookOpen, Image, Plane,
  Syringe, Scale
} from "lucide-react";

export default function AdminContent() {
  const { data, isLoading } = useAdminContentStats();
  const c = data?.data || {};

  const items = [
    { icon: Calendar, label: "مناسبات التقويم", value: c.events || 0, color: "bg-rose-500" },
    { icon: ListTodo, label: "إجمالي المهام", value: c.tasks || 0, sub: `${c.tasks_done || 0} منجزة`, color: "bg-teal-600" },
    { icon: ShoppingCart, label: "قوائم التسوق", value: c.market_lists || 0, sub: `${c.market_items || 0} عنصر`, color: "bg-orange-500" },
    { icon: Pill, label: "الأدوية النشطة", value: c.medications || 0, sub: `${c.med_logs || 0} سجل`, color: "bg-pink-500" },
    { icon: Wallet, label: "الديون النشطة", value: c.debts || 0, sub: `${c.debts_paid || 0} مسددة`, color: "bg-indigo-500" },
    { icon: Plane, label: "الرحلات", value: c.trips || 0, color: "bg-cyan-600" },
    { icon: FileText, label: "الوثائق", value: c.documents || 0, sub: `${c.docs_expiring || 0} تنتهي قريباً`, color: "bg-slate-600" },
    { icon: Image, label: "الألبومات", value: c.albums || 0, sub: `${c.photos || 0} صورة`, color: "bg-violet-500" },
    { icon: Car, label: "المركبات", value: c.vehicles || 0, color: "bg-emerald-600" },
    { icon: MapPin, label: "الأماكن", value: c.places || 0, color: "bg-red-500" },
    { icon: MessageSquare, label: "رسائل الدردشة", value: c.chat_messages || 0, color: "bg-blue-600" },
    { icon: BookOpen, label: "الوصايا", value: c.wills || 0, color: "bg-amber-600" },
    { icon: Syringe, label: "أطفال التطعيمات", value: c.vacc_children || 0, color: "bg-green-600" },
    { icon: Scale, label: "حسابات الزكاة", value: c.zakat || 0, color: "bg-yellow-600" },
  ];

  const chartData = items.map(i => ({ name: i.label, count: typeof i.value === "number" ? i.value : 0 })).sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${item.color}`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-1" /> : (
                  <>
                    <p className="text-xl font-bold">{item.value}</p>
                    {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle>توزيع المحتوى</CardTitle></CardHeader>
        <CardContent className="h-80">
          {isLoading ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(215, 70%, 50%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
