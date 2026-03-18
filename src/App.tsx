import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IslamicModeProvider } from "@/contexts/IslamicModeContext";
import { TrashProvider } from "@/contexts/TrashContext";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
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
import BottomNav from "@/components/home/BottomNav";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/tasbih" element={<Tasbih />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/map" element={<Map />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/family" element={<FamilyManagement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <IslamicModeProvider>
      <TrashProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AnimatedRoutes />
            <BottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </TrashProvider>
    </IslamicModeProvider>
  </QueryClientProvider>
);

export default App;
