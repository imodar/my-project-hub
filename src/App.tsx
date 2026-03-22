import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IslamicModeProvider } from "@/contexts/IslamicModeContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { TrashProvider } from "@/contexts/TrashContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import ScrollToTop from "@/components/ScrollToTop";
import OfflineBanner from "@/components/OfflineBanner";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
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
import AdminDashboard from "./pages/AdminDashboard.tsx";
import IslamicReminders from "./pages/IslamicReminders.tsx";
import BottomNav from "@/components/home/BottomNav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount) => navigator.onLine && failureCount < 2,
      networkMode: "offlineFirst",
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        {/* Public route */}
        <Route path="/auth" element={<Auth />} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
        <Route path="/tasbih" element={<AuthGuard><Tasbih /></AuthGuard>} />
        <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/map" element={<AuthGuard><Map /></AuthGuard>} />
        <Route path="/debts" element={<AuthGuard><Debts /></AuthGuard>} />
        <Route path="/family" element={<AuthGuard><FamilyManagement /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
        <Route path="/calendar" element={<AuthGuard><CalendarPage /></AuthGuard>} />
        <Route path="/trash" element={<AuthGuard><Trash /></AuthGuard>} />
        <Route path="/market" element={<AuthGuard><Market /></AuthGuard>} />
        <Route path="/places" element={<AuthGuard><Places /></AuthGuard>} />
        <Route path="/places/add" element={<AuthGuard><AddPlace /></AuthGuard>} />
        <Route path="/places/edit/:id" element={<AuthGuard><AddPlace /></AuthGuard>} />
        <Route path="/budget" element={<AuthGuard><Budget /></AuthGuard>} />
        <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
        <Route path="/documents" element={<AuthGuard><Documents /></AuthGuard>} />
        <Route path="/zakat" element={<AuthGuard><Zakat /></AuthGuard>} />
        <Route path="/will" element={<AuthGuard><Will /></AuthGuard>} />
        <Route path="/trips" element={<AuthGuard><Trips /></AuthGuard>} />
        <Route path="/albums" element={<AuthGuard><Albums /></AuthGuard>} />
        <Route path="/kids-worship" element={<AuthGuard><KidsWorship /></AuthGuard>} />
        <Route path="/parent-dashboard" element={<AuthGuard><ParentDashboard /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
        <Route path="/athkar" element={<AuthGuard><Athkar /></AuthGuard>} />
        <Route path="/vehicle" element={<AuthGuard><Vehicle /></AuthGuard>} />
        <Route path="/vaccinations" element={<AuthGuard><Vaccinations /></AuthGuard>} />
        <Route path="/medications" element={<AuthGuard><Medications /></AuthGuard>} />
        <Route path="/islamic-reminders" element={<AuthGuard><IslamicReminders /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
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
          <IslamicModeProvider>
            <TrashProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <OfflineBanner />
                  <ScrollToTop />
                  <AnimatedRoutes />
                  <BottomNav />
                </BrowserRouter>
              </TooltipProvider>
            </TrashProvider>
          </IslamicModeProvider>
        </UserRoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
