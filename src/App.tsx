import React, { Suspense, useEffect, useRef } from "react";
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

import FirstSyncOverlay from "@/components/FirstSyncOverlay";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { useFamilyId } from "@/hooks/useFamilyId";
import { warmCache } from "@/lib/warmCache";
import { useFamilyRealtime } from "@/hooks/useFamilyRealtime";
import { ListPageSkeleton } from "@/components/PageSkeletons";
import BottomNav from "@/components/home/BottomNav";
import RoleGuard from "@/components/RoleGuard";

// ── Lazy-loaded pages ──
const Auth = React.lazy(() => import("./pages/Auth.tsx"));
const GetStarted = React.lazy(() => import("./pages/GetStarted.tsx"));
const Index = React.lazy(() => import("./pages/Index.tsx"));
const Tasbih = React.lazy(() => import("./pages/Tasbih.tsx"));
const Settings = React.lazy(() => import("./pages/Settings.tsx"));
const NotFound = React.lazy(() => import("./pages/NotFound.tsx"));
const Chat = React.lazy(() => import("./pages/Chat.tsx"));
const Map = React.lazy(() => import("./pages/Map.tsx"));
const Debts = React.lazy(() => import("./pages/Debts.tsx"));
const FamilyManagement = React.lazy(() => import("./pages/FamilyManagement.tsx"));
const JoinOrCreate = React.lazy(() => import("./pages/JoinOrCreate.tsx"));
const CompleteProfile = React.lazy(() => import("./pages/CompleteProfile.tsx"));
const Profile = React.lazy(() => import("./pages/Profile.tsx"));
const CalendarPage = React.lazy(() => import("./pages/Calendar.tsx"));
const Trash = React.lazy(() => import("./pages/Trash.tsx"));
const Market = React.lazy(() => import("./pages/Market.tsx"));
const Places = React.lazy(() => import("./pages/Places.tsx"));
const AddPlace = React.lazy(() => import("./pages/AddPlace.tsx"));
const Budget = React.lazy(() => import("./pages/Budget.tsx"));
const Tasks = React.lazy(() => import("./pages/Tasks.tsx"));
const Documents = React.lazy(() => import("./pages/Documents.tsx"));
const Zakat = React.lazy(() => import("./pages/Zakat.tsx"));
const Will = React.lazy(() => import("./pages/Will.tsx"));
const Trips = React.lazy(() => import("./pages/Trips.tsx"));
const Albums = React.lazy(() => import("./pages/Albums.tsx"));
const KidsWorship = React.lazy(() => import("./pages/KidsWorship.tsx"));
const ParentDashboard = React.lazy(() => import("./pages/ParentDashboard.tsx"));
const Athkar = React.lazy(() => import("./pages/Athkar.tsx"));
const Vehicle = React.lazy(() => import("./pages/Vehicle.tsx"));
const Vaccinations = React.lazy(() => import("./pages/Vaccinations.tsx"));
const Medications = React.lazy(() => import("./pages/Medications.tsx"));
const IslamicReminders = React.lazy(() => import("./pages/IslamicReminders.tsx"));

// Admin Panel (lazy)
const AdminLayout = React.lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = React.lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminFamilies = React.lazy(() => import("./pages/admin/AdminFamilies"));
const AdminContent = React.lazy(() => import("./pages/admin/AdminContent"));
const AdminNotifications = React.lazy(() => import("./pages/admin/AdminNotifications"));
const AdminSubscriptions = React.lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminSystem = React.lazy(() => import("./pages/admin/AdminSystem"));
const AdminAudit = React.lazy(() => import("./pages/admin/AdminAudit"));
const AdminSecurity = React.lazy(() => import("./pages/admin/AdminSecurity"));
const AdminLegalPages = React.lazy(() => import("./pages/admin/AdminLegalPages"));

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

/** Wraps a page element with a per-route ErrorBoundary */
const R = ({ route, children }: { route: string; children: React.ReactNode }) => (
  <RouteErrorBoundary route={route}>{children}</RouteErrorBoundary>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/admin-panel");

  if (isAdminPanel) {
    return (
      <Routes>
        <Route path="/admin-panel" element={<AuthGuard><R route="admin"><AdminLayout /></R></AuthGuard>}>
          <Route index element={<R route="admin-overview"><AdminOverview /></R>} />
          <Route path="users" element={<R route="admin-users"><AdminUsers /></R>} />
          <Route path="families" element={<R route="admin-families"><AdminFamilies /></R>} />
          <Route path="content" element={<R route="admin-content"><AdminContent /></R>} />
          <Route path="notifications" element={<R route="admin-notifications"><AdminNotifications /></R>} />
          <Route path="subscriptions" element={<R route="admin-subscriptions"><AdminSubscriptions /></R>} />
          <Route path="system" element={<R route="admin-system"><AdminSystem /></R>} />
          <Route path="audit" element={<R route="admin-audit"><AdminAudit /></R>} />
          <Route path="security" element={<R route="admin-security"><AdminSecurity /></R>} />
          <Route path="legal" element={<R route="admin-legal"><AdminLegalPages /></R>} />
        </Route>
      </Routes>
    );
  }

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        {/* Public routes */}
        <Route path="/get-started" element={<R route="get-started"><GetStarted /></R>} />
        <Route path="/auth" element={<R route="auth"><Auth /></R>} />
        <Route path="/complete-profile" element={<R route="complete-profile"><CompleteProfile /></R>} />
        <Route path="/join-or-create" element={<R route="join-or-create"><JoinOrCreate /></R>} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><R route="home"><Index /></R></AuthGuard>} />
        <Route path="/tasbih" element={<AuthGuard><R route="tasbih"><Tasbih /></R></AuthGuard>} />
        <Route path="/chat" element={<AuthGuard><R route="chat"><Chat /></R></AuthGuard>} />
        <Route path="/map" element={<AuthGuard><R route="map"><Map /></R></AuthGuard>} />
        <Route path="/debts" element={<AuthGuard><R route="debts"><Debts /></R></AuthGuard>} />
        <Route path="/family" element={<AuthGuard><R route="family"><FamilyManagement /></R></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><R route="profile"><Profile /></R></AuthGuard>} />
        <Route path="/calendar" element={<AuthGuard><RoleGuard requireNonStaff><R route="calendar"><CalendarPage /></R></RoleGuard></AuthGuard>} />
        <Route path="/trash" element={<AuthGuard><R route="trash"><Trash /></R></AuthGuard>} />
        <Route path="/market" element={<AuthGuard><R route="market"><Market /></R></AuthGuard>} />
        <Route path="/places" element={<AuthGuard><RoleGuard requireNonStaff><R route="places"><Places /></R></RoleGuard></AuthGuard>} />
        <Route path="/places/add" element={<AuthGuard><R route="places-add"><AddPlace /></R></AuthGuard>} />
        <Route path="/places/edit/:id" element={<AuthGuard><R route="places-edit"><AddPlace /></R></AuthGuard>} />
        <Route path="/budget" element={<AuthGuard><R route="budget"><Budget /></R></AuthGuard>} />
        <Route path="/tasks" element={<AuthGuard><R route="tasks"><Tasks /></R></AuthGuard>} />
        <Route path="/documents" element={<AuthGuard><R route="documents"><Documents /></R></AuthGuard>} />
        <Route path="/zakat" element={<AuthGuard><RoleGuard requireNonStaff><R route="zakat"><Zakat /></R></RoleGuard></AuthGuard>} />
        <Route path="/will" element={<AuthGuard><RoleGuard requireNonStaff><R route="will"><Will /></R></RoleGuard></AuthGuard>} />
        <Route path="/trips" element={<AuthGuard><R route="trips"><Trips /></R></AuthGuard>} />
        <Route path="/albums" element={<AuthGuard><RoleGuard requireNonStaff><R route="albums"><Albums /></R></RoleGuard></AuthGuard>} />
        <Route path="/kids-worship" element={<AuthGuard><R route="kids-worship"><KidsWorship /></R></AuthGuard>} />
        <Route path="/parent-dashboard" element={<AuthGuard><R route="parent-dashboard"><ParentDashboard /></R></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><R route="settings"><Settings /></R></AuthGuard>} />
        <Route path="/athkar" element={<AuthGuard><R route="athkar"><Athkar /></R></AuthGuard>} />
        <Route path="/vehicle" element={<AuthGuard><R route="vehicle"><Vehicle /></R></AuthGuard>} />
        <Route path="/vaccinations" element={<AuthGuard><R route="vaccinations"><Vaccinations /></R></AuthGuard>} />
        <Route path="/medications" element={<AuthGuard><R route="medications"><Medications /></R></AuthGuard>} />
        <Route path="/islamic-reminders" element={<AuthGuard><R route="islamic-reminders"><IslamicReminders /></R></AuthGuard>} />
        
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
                    <FirstSyncOverlay />
                    <ScrollToTop />
                    <WarmCacheProvider>
                      <Suspense fallback={null}>
                        <AnimatedRoutes />
                      </Suspense>
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
