import { Suspense } from "react";
import { AuthPanel } from "@/app/components/auth-panel";
import { FarmDashboard } from "@/app/components/farm-dashboard";
import { getAppContext } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export default function Home() {
  return (
    <Suspense fallback={<div className="app-loading">Loading your farm...</div>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const context = await getAppContext();
  if (!context) return <AuthPanel initialLocale="en" />;

  const dashboardData = await getDashboardData(context);
  return <FarmDashboard data={dashboardData} />;
}
