import { useEffect } from "react";
import HeroSection from "@/components/home/HeroSection";
import IslamicQuickActions from "@/components/home/IslamicQuickActions";
import FeatureGrid from "@/components/home/FeatureGrid";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import PullToRefresh from "@/components/PullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { preloadCriticalPages } from "@/lib/preloadPages";

const Index = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    preloadCriticalPages();
  }, []);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-background relative">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="stagger-item stagger-item-1"><HeroSection /></div>
        <div className="stagger-item stagger-item-2"><IslamicQuickActions /></div>
        <div className="stagger-item stagger-item-3"><FeatureGrid /></div>
        <div className="stagger-item stagger-item-4"><UpcomingEvents /></div>
      </PullToRefresh>
    </div>
  );
};

export default Index;
