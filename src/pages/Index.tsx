import HeroSection from "@/components/home/HeroSection";
import IslamicQuickActions from "@/components/home/IslamicQuickActions";
import FeatureGrid from "@/components/home/FeatureGrid";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import DailyTasks from "@/components/home/DailyTasks";
import PullToRefresh from "@/components/PullToRefresh";
import SOSButton from "@/components/home/SOSButton";
import { useQueryClient } from "@tanstack/react-query";

const Index = () => {
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative">
      <PullToRefresh onRefresh={handleRefresh}>
        <HeroSection />
        <IslamicQuickActions />
        <FeatureGrid />
        <UpcomingEvents />
        <DailyTasks />
      </PullToRefresh>
      <SOSButton />
    </div>
  );
};

export default Index;
