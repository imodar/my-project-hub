import HeroSection from "@/components/home/HeroSection";
import QuickActions from "@/components/home/QuickActions";
import FeatureGrid from "@/components/home/FeatureGrid";
import UpcomingEvents from "@/components/home/UpcomingEvents";
import DailyTasks from "@/components/home/DailyTasks";
import BottomNav from "@/components/home/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto relative">
      <HeroSection />
      <QuickActions />
      <FeatureGrid />
      <UpcomingEvents />
      <DailyTasks />
      <BottomNav />
    </div>
  );
};

export default Index;
