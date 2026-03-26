import React, { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQueryClient, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IslamicModeProvider } from "@/contexts/IslamicModeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { TrashProvider } from "@/contexts/TrashContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import ScrollToTop from "@/components/ScrollToTop";
import OfflineBanner from "@/components/OfflineBanner";
import StaleBanner from "@/components/StaleBanner";
import FirstSyncOverlay from "@/components/FirstSyncOverlay";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { useFamilyId } from "@/hooks/useFamilyId";
import { warmCache } from "@/lib/warmCache";
import { useFamilyRealtime } from "@/hooks/useFamilyRealtime";
import Auth from "./pages/Auth.tsx";
import GetStarted from "./pages/GetStarted.tsx";
import Index from "./pages/Index.tsx";
import Tasbih from "./pages/Tasbih.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import Chat from "./pages/Chat.tsx";
import Map from "./pages/Map.tsx";
import Debts from "./pages/Debts.tsx";
import FamilyManagement from "./pages/FamilyManagement.tsx";
import JoinOrCreate from "./pages/JoinOrCreate.tsx";
import CompleteProfile from "./pages/CompleteProfile.tsx";
import Profile from "./pages/Profile.tsx";
import CalendarPage from "./pages/Calendar.tsx";
import Trash from "./pages/Trash.tsx";
import Market from "./pages/Market.tsx";
import Places from "./pages/Places.tsx";
import AddPlace from "./pages/AddPlace.tsx";
import Budget from "./pages/Budget.tsx";
import Tasks from "./pages/Tasks.tsx";
import Documents from "./pages/Documents.tsx";
import Zakat from "./pages/Zakat.tsx";
import Will from "./pages/Will.tsx";
import Trips from "./pages/Trips.tsx";
import Albums from "./pages/Albums.tsx";
import KidsWorship from "./pages/KidsWorship.tsx";
import ParentDashboard from "./pages/ParentDashboard.tsx";
import Athkar from "./pages/Athkar.tsx";
import Vehicle from "./pages/Vehicle.tsx";
import Vaccinations from "./pages/Vaccinations.tsx";
import Medications from "./pages/Medications.tsx";
import IslamicReminders from "./pages/IslamicReminders.tsx";

import BottomNav from "@/components/home/BottomNav";
import RoleGuard from "@/components/RoleGuard";

// Admin Panel
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminFamilies from "./pages/admin/AdminFamilies";
import AdminContent from "./pages/admin/AdminContent";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSecurity from "./pages/admin/AdminSecurity";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      toast.error("فشل الحفظ", { description: message });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount) => navigator.onLine && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      networkMode: "offlineFirst",
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 1,
    },
  },
});

/** Pre-warms React Query cache from IndexedDB on startup + global Realtime */
const WarmCacheProvider = ({ children }: { children: React.ReactNode }) => {
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const warmedRef = useRef(false);

  // Global realtime for cross-device sync
  useFamilyRealtime();

  useEffect(() => {
    if (familyId && !warmedRef.current) {
      warmedRef.current = true;
      warmCache(qc, familyId);
    }
  }, [familyId, qc]);

  // Listen for sync queue failures and notify user
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast.error(`فشلت مزامنة ${detail.label || "البيانات"}`, {
        description: "تحقق من الاتصال وحاول مرة أخرى",
      });
    };
    window.addEventListener("sync-queue-failed", handler);
    return () => window.removeEventListener("sync-queue-failed", handler);
  }, []);

  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/admin-panel");

  if (isAdminPanel) {
    return (
      <Routes>
        <Route path="/admin-panel" element={<AuthGuard><AdminLayout /></AuthGuard>}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="families" element={<AdminFamilies />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="system" element={<AdminSystem />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="security" element={<AdminSecurity />} />
        </Route>
      </Routes>
    );
  }

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        {/* Public routes */}
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/join-or-create" element={<JoinOrCreate />} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
        <Route path="/tasbih" element={<AuthGuard><Tasbih /></AuthGuard>} />
        <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/map" element={<AuthGuard><Map /></AuthGuard>} />
        <Route path="/debts" element={<AuthGuard><Debts /></AuthGuard>} />
        <Route path="/family" element={<AuthGuard><FamilyManagement /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        <Route path="/calendar" element={<AuthGuard><RoleGuard requireNonStaff><CalendarPage /></RoleGuard></AuthGuard>} />
        <Route path="/trash" element={<AuthGuard><Trash /></AuthGuard>} />
        <Route path="/market" element={<AuthGuard><Market /></AuthGuard>} />
        <Route path="/places" element={<AuthGuard><RoleGuard requireNonStaff><Places /></RoleGuard></AuthGuard>} />
        <Route path="/places/add" element={<AuthGuard><AddPlace /></AuthGuard>} />
        <Route path="/places/edit/:id" element={<AuthGuard><AddPlace /></AuthGuard>} />
        <Route path="/budget" element={<AuthGuard><Budget /></AuthGuard>} />
        <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
        <Route path="/documents" element={<AuthGuard><Documents /></AuthGuard>} />
        <Route path="/zakat" element={<AuthGuard><RoleGuard requireNonStaff><Zakat /></RoleGuard></AuthGuard>} />
        <Route path="/will" element={<AuthGuard><RoleGuard requireNonStaff><Will /></RoleGuard></AuthGuard>} />
        <Route path="/trips" element={<AuthGuard><Trips /></AuthGuard>} />
        <Route path="/albums" element={<AuthGuard><RoleGuard requireNonStaff><Albums /></RoleGuard></AuthGuard>} />
        <Route path="/kids-worship" element={<AuthGuard><KidsWorship /></AuthGuard>} />
        <Route path="/parent-dashboard" element={<AuthGuard><ParentDashboard /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
        <Route path="/athkar" element={<AuthGuard><Athkar /></AuthGuard>} />
        <Route path="/vehicle" element={<AuthGuard><Vehicle /></AuthGuard>} />
        <Route path="/vaccinations" element={<AuthGuard><Vaccinations /></AuthGuard>} />
        <Route path="/medications" element={<AuthGuard><Medications /></AuthGuard>} />
        <Route path="/islamic-reminders" element={<AuthGuard><IslamicReminders /></AuthGuard>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserRoleProvider>
          <LanguageProvider>
            <IslamicModeProvider>
              <TrashProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <OfflineBanner />
                    <StaleBanner />
                    <FirstSyncOverlay />
                    <ScrollToTop />
                    <WarmCacheProvider>
                      <AnimatedRoutes />
                    </WarmCacheProvider>
                    <BottomNav />
                  </BrowserRouter>
                </TooltipProvider>
              </TrashProvider>
            </IslamicModeProvider>
          </LanguageProvider>
        </UserRoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
