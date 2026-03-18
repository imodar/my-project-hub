import HeroSection from "@/components/home/HeroSection";
import QuickActions from "@/components/home/QuickActions";
import FeatureGrid from "@/components/home/FeatureGrid";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import DailyTasks from "@/components/home/DailyTasks";
import BottomNav from "@/components/home/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";

const Index = () => {
  const handleRefresh = async () => {
    // Simulate refresh delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative">
      <PullToRefresh onRefresh={handleRefresh}>
        <HeroSection />
        <QuickActions />
        <FeatureGrid />
        <UpcomingEvents />
        <DailyTasks />
      </PullToRefresh>
      <BottomNav />
    </div>
  );
};

export default Index;
