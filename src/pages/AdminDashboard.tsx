import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Users, Activity, FileText, AlertTriangle,
  TrendingUp, Clock, Eye, Trash2, Ban, CheckCircle,
  BarChart3, Settings, ChevronLeft, RefreshCw
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { appToast } from "@/lib/toast";

interface DashboardStats {
  totalUsers: number;
  totalFamilies: number;
  activeUsers: number;
  pendingDeletions: number;
}

interface AuditEntry {
  id: string;
  action: string;
  admin_id: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
  details: any;
}

interface UserProfile {
  id: string;
  name: string | null;
  phone: string | null;
  subscription_plan: string;
  created_at: string;
  last_login_at: string | null;
  is_deleted: boolean;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, totalFamilies: 0, activeUsers: 0, pendingDeletions: 0,
  });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Check admin role via admin-api
  useEffect(() => {
    if (!user) return;
    checkAdmin();
    async function checkAdmin() {
      try {
        const { data, error } = await supabase.functions.invoke("admin-api", {
          body: { action: "dashboard-full" },
        });
        if (error || data?.error) {
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
          // Use the dashboard data directly
          const d = data?.data;
          if (d) {
            setStats({
              totalUsers: d.total_users || 0,
              totalFamilies: d.total_families || 0,
              activeUsers: d.active_today || 0,
              pendingDeletions: 0,
            });
          }
          loadDashboard();
        }
      } catch {
        setIsAdmin(false);
      }
      setLoading(false);
    }
  }, [user]);

  const loadDashboard = async () => {
    try {
      // Load stats via admin-api
      const { data: dashData } = await supabase.functions.invoke("admin-api", {
        body: { action: "dashboard-full" },
      });
      if (dashData?.data) {
        const d = dashData.data;
        setStats({
          totalUsers: d.total_users || 0,
          totalFamilies: d.total_families || 0,
          activeUsers: d.active_today || 0,
          pendingDeletions: 0,
        });
      }

      // Load audit log via admin-api
      const { data: auditData } = await supabase.functions.invoke("admin-api", {
        body: { action: "get-audit-log", limit: 50 },
      });
      setAuditLog(auditData?.data || []);

      // Load users via admin-api
      const { data: usersData } = await supabase.functions.invoke("admin-api", {
        body: { action: "get-users", limit: 100 },
      });
      setUsers(usersData?.data || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-destructive" />
        </div>
        <h2 className="text-lg font-extrabold text-foreground mb-2">غير مصرح</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          ليس لديك صلاحية الوصول إلى لوحة الإدارة
        </p>
        <Button onClick={() => navigate("/")} variant="outline">
          <ChevronLeft size={16} className="ml-2" />
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  const statCards = [
    { label: "إجمالي المستخدمين", value: stats.totalUsers, icon: Users, color: "hsl(215 70% 50%)" },
    { label: "العائلات", value: stats.totalFamilies, icon: Shield, color: "hsl(145 45% 40%)" },
    { label: "نشط (30 يوم)", value: stats.activeUsers, icon: Activity, color: "hsl(35 80% 45%)" },
    { label: "طلبات حذف", value: stats.pendingDeletions, icon: Trash2, color: "hsl(0 60% 50%)" },
  ];

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      "user_banned": "حظر مستخدم",
      "user_unbanned": "إلغاء حظر",
      "family_deleted": "حذف عائلة",
      "role_changed": "تغيير صلاحية",
      "settings_updated": "تحديث إعدادات",
      "data_export": "تصدير بيانات",
    };
    return labels[action] || action;
  };

  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      <PageHeader
        title="لوحة الإدارة"
        subtitle="إدارة النظام والمستخدمين"
        onBack={() => navigate("/")}
        actions={[
          {
            icon: <RefreshCw size={18} className="text-white" />,
            onClick: loadDashboard,
          },
        ]}
      />

      <div className="px-4 mt-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${stat.color}15` }}
                >
                  <stat.icon size={16} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="text-xs font-bold">
              <BarChart3 size={14} className="ml-1" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs font-bold">
              <Users size={14} className="ml-1" /> المستخدمون
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs font-bold">
              <FileText size={14} className="ml-1" /> سجل التدقيق
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-extrabold text-foreground mb-3">إحصائيات سريعة</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">معدل النشاط</span>
                  <span className="text-sm font-bold text-foreground">
                    {stats.totalUsers > 0
                      ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{
                      width: `${stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Recent audit */}
            <div className="p-4 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-extrabold text-foreground mb-3">آخر الأحداث</h3>
              {auditLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد أحداث</p>
              ) : (
                <div className="space-y-2">
                  {auditLog.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                        <Activity size={14} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{getActionLabel(entry.action)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="space-y-2">
            {users.length === 0 ? (
              <div className="text-center py-10">
                <Users size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
              </div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-card border border-border flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(u.name || "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {u.name || "بدون اسم"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{u.phone || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={u.subscription_plan === "premium" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {u.subscription_plan}
                    </Badge>
                    {u.is_deleted && (
                      <Badge variant="destructive" className="text-[10px]">محذوف</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Audit Log */}
          <TabsContent value="audit" className="space-y-2">
            {auditLog.length === 0 ? (
              <div className="text-center py-10">
                <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">سجل التدقيق فارغ</p>
              </div>
            ) : (
              auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-card border border-border"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground">
                      {getActionLabel(entry.action)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("ar-SA")}
                    </span>
                  </div>
                  {entry.target_type && (
                    <p className="text-[11px] text-muted-foreground">
                      النوع: {entry.target_type}
                      {entry.target_id && ` • المعرف: ${entry.target_id.slice(0, 8)}...`}
                    </p>
                  )}
                  {entry.details && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                      {JSON.stringify(entry.details).slice(0, 80)}
                    </p>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
