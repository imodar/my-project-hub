import HeroSection from "@/components/home/HeroSection";
import FeatureGrid from "@/components/home/FeatureGrid";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import DailyTasks from "@/components/home/DailyTasks";
import PullToRefresh from "@/components/PullToRefresh";

const Index = () => {
  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative">
      <PullToRefresh onRefresh={handleRefresh}>
        <HeroSection />
        <FeatureGrid />
        <UpcomingEvents />
        <DailyTasks />
      </PullToRefresh>
    </div>
  );
};

export default Index;
