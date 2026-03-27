import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Home, Bell, Shield, Settings,
  FileText, CreditCard, Menu, X, ChevronLeft, Activity,
  BarChart3, ScrollText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/admin-panel", icon: LayoutDashboard, label: "نظرة عامة", end: true },
  { to: "/admin-panel/users", icon: Users, label: "المستخدمين" },
  { to: "/admin-panel/families", icon: Home, label: "العائلات" },
  { to: "/admin-panel/content", icon: BarChart3, label: "المحتوى والبيانات" },
  { to: "/admin-panel/notifications", icon: Bell, label: "التنبيهات" },
  { to: "/admin-panel/subscriptions", icon: CreditCard, label: "الاشتراكات" },
  { to: "/admin-panel/system", icon: Settings, label: "النظام والإصدارات" },
  { to: "/admin-panel/audit", icon: FileText, label: "سجل التدقيق" },
  { to: "/admin-panel/security", icon: Shield, label: "الأمان" },
  { to: "/admin-panel/legal", icon: ScrollText, label: "الصفحات القانونية" },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-muted/30" dir="rtl">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full z-50 bg-card border-l border-border flex flex-col transition-all duration-300",
          "lg:sticky lg:top-0 lg:z-auto",
          collapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "w-64 translate-x-0" : "w-64 translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">لوحة التحكم</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className="hidden lg:flex"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="p-3 border-t border-border">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5 shrink-0 rotate-180" />
            {!collapsed && <span>العودة للتطبيق</span>}
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-h-screen">
        {/* Top bar (mobile) */}
        <header className="h-16 bg-card border-b border-border flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden ml-2">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">
            {navItems.find(i => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))?.label || "لوحة التحكم"}
          </h1>
        </header>

        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
