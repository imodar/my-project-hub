import React, { Suspense, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import AppToast from "@/components/AppToast";
import { appToast } from "@/lib/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IslamicModeProvider } from "@/contexts/IslamicModeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { TrashProvider } from "@/contexts/TrashContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import ScrollToTop from "@/components/ScrollToTop";
import OfflineBanner from "@/components/OfflineBanner";

import FirstSyncOverlay from "@/components/FirstSyncOverlay";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { useFamilyId } from "@/hooks/useFamilyId";
import { warmCacheCritical, warmCacheDeferred } from "@/lib/warmCache";
import { getMeaningfulLocalDataState } from "@/lib/meaningfulLocalData";
import { useFamilyRealtime } from "@/hooks/useFamilyRealtime";
import { usePendingMemberAlert } from "@/hooks/usePendingMemberAlert";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { ListPageSkeleton } from "@/components/PageSkeletons";
import BottomNav from "@/components/home/BottomNavWhatsApp";
import SOSButton from "@/components/home/SOSButton";
import RoleGuard from "@/components/RoleGuard";

// ── Retry wrapper for stale chunk recovery ──
function lazyRetry(importFn: () => Promise<any>) {
  return React.lazy(() =>
    importFn().catch(() => {
      // Stale chunk — reload once to get fresh assets
      const key = "chunk_reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      return importFn(); // fallback attempt
    })
  );
}

// ── Eager-loaded core pages (no white flash) ──
import Index from "./pages/Index";
import Market from "./pages/Market";
import Tasks from "./pages/Tasks";
import Chat from "./pages/Chat";
import CalendarPage from "./pages/Calendar";

// ── Lazy-loaded pages ──
const Auth = lazyRetry(() => import("./pages/Auth.tsx"));
const GetStarted = lazyRetry(() => import("./pages/GetStarted.tsx"));
const Tasbih = lazyRetry(() => import("./pages/Tasbih.tsx"));
const Settings = lazyRetry(() => import("./pages/Settings.tsx"));
const NotFound = lazyRetry(() => import("./pages/NotFound.tsx"));
const Map = lazyRetry(() => import("./pages/Map.tsx"));
const Debts = lazyRetry(() => import("./pages/Debts.tsx"));
const FamilyManagement = lazyRetry(() => import("./pages/FamilyManagement.tsx"));
const JoinOrCreate = lazyRetry(() => import("./pages/JoinOrCreate.tsx"));
const CompleteProfile = lazyRetry(() => import("./pages/CompleteProfile.tsx"));
const Profile = lazyRetry(() => import("./pages/Profile.tsx"));
const Trash = lazyRetry(() => import("./pages/Trash.tsx"));
const Places = lazyRetry(() => import("./pages/Places.tsx"));
const AddPlace = lazyRetry(() => import("./pages/AddPlace.tsx"));
const Budget = lazyRetry(() => import("./pages/Budget.tsx"));
const Documents = lazyRetry(() => import("./pages/Documents.tsx"));
const Zakat = lazyRetry(() => import("./pages/Zakat.tsx"));
const Will = lazyRetry(() => import("./pages/Will.tsx"));
const Trips = lazyRetry(() => import("./pages/Trips.tsx"));
const Albums = lazyRetry(() => import("./pages/Albums.tsx"));
const KidsWorship = lazyRetry(() => import("./pages/KidsWorship.tsx"));
const ParentDashboard = lazyRetry(() => import("./pages/ParentDashboard.tsx"));
const Athkar = lazyRetry(() => import("./pages/Athkar.tsx"));
const Vehicle = lazyRetry(() => import("./pages/Vehicle.tsx"));
const Vaccinations = lazyRetry(() => import("./pages/Vaccinations.tsx"));
const Medications = lazyRetry(() => import("./pages/Medications.tsx"));
const IslamicReminders = lazyRetry(() => import("./pages/IslamicReminders.tsx"));
const Subscription = lazyRetry(() => import("./pages/Subscription.tsx"));

// Admin Panel (lazy)
const AdminLayout = lazyRetry(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazyRetry(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazyRetry(() => import("./pages/admin/AdminUsers"));
const AdminFamilies = lazyRetry(() => import("./pages/admin/AdminFamilies"));
const AdminContent = lazyRetry(() => import("./pages/admin/AdminContent"));
const AdminNotifications = lazyRetry(() => import("./pages/admin/AdminNotifications"));
const AdminSubscriptions = lazyRetry(() => import("./pages/admin/AdminSubscriptions"));
const AdminSystem = lazyRetry(() => import("./pages/admin/AdminSystem"));
const AdminAudit = lazyRetry(() => import("./pages/admin/AdminAudit"));
const AdminSecurity = lazyRetry(() => import("./pages/admin/AdminSecurity"));
const AdminLegalPages = lazyRetry(() => import("./pages/admin/AdminLegalPages"));

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      appToast.error("فشل الحفظ", message);
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
  const { user } = useAuth();
  const { familyId, isLoading: familyLoading } = useFamilyId();
  const qc = useQueryClient();
  const warmedFamilyRef = useRef<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(() => !!localStorage.getItem("first_sync_done"));
  const hasResolvedNoFamily = !!user && !familyLoading && !familyId;
  const familyCacheReady = !!familyId && warmedFamilyRef.current === familyId && cacheReady;
  const familyUiReady = !!familyId && familyCacheReady && initialSyncDone;
  const allowChildren = !user || hasResolvedNoFamily || familyUiReady;

  // Global realtime for cross-device sync
  useFamilyRealtime();
  usePendingMemberAlert();
  // Initialize RevenueCat SDK once user is logged in (native platforms only)
  useRevenueCat();

  useEffect(() => {
    if (!user) {
      warmedFamilyRef.current = null;
      setInitialSyncDone(true);
      setCacheReady(true);
      return;
    }

    warmedFamilyRef.current = null;
    setCacheReady(false);

    const lsFlag = !!localStorage.getItem("first_sync_done");
    if (lsFlag) {
      setInitialSyncDone(true);
    } else {
      setInitialSyncDone(false);
      getMeaningfulLocalDataState().then(({ hasMeaningfulLocalData }) => {
        if (hasMeaningfulLocalData) {
          localStorage.setItem("first_sync_done", "1");
          setInitialSyncDone(true);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    if (!familyId) {
      if (!familyLoading) {
        setCacheReady(true);
      }
      return;
    }

    if (!initialSyncDone) {
      setCacheReady(false);
      return;
    }

    if (warmedFamilyRef.current === familyId && cacheReady) return;

    let cancelled = false;
    setCacheReady(false);
    warmedFamilyRef.current = familyId;

    // المرحلة 1: تسخين الجداول الحرجة (تحجب العرض)
    warmCacheCritical(qc, familyId)
      .then(() => {
        if (!cancelled) setCacheReady(true);
        // المرحلة 2: تسخين باقي الجداول في الخلفية
        warmCacheDeferred(qc, familyId).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setCacheReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, familyId, familyLoading, initialSyncDone, qc]);

  // Listen for sync queue failures and notify user
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      appToast.error(`فشلت مزامنة ${detail.label || "البيانات"}`, "تحقق من الاتصال وحاول مرة أخرى");
    };
    window.addEventListener("sync-queue-failed", handler);
    return () => window.removeEventListener("sync-queue-failed", handler);
  }, []);

  return (
    <>
      <FirstSyncOverlay onInitialSyncReady={() => setInitialSyncDone(true)} />
      {allowChildren ? children : null}
    </>
  );
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
        <Route path="/subscription" element={<AuthGuard><R route="subscription"><Subscription /></R></AuthGuard>} />
        
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
                  <AppToast />
                  <BrowserRouter>
                    <OfflineBanner />
                    <ScrollToTop />
                    <WarmCacheProvider>
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                        <AnimatedRoutes />
                      </Suspense>
                      <BottomNav />
                      <SOSButton />
                    </WarmCacheProvider>
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
