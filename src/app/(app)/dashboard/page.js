import DashboardView from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/services/dashboard";

export const metadata = { title: "Dashboard | Inventory Management" };

export default function DashboardPage() {
  const { cards, chart } = getDashboardData();
  return <DashboardView cards={cards} chart={chart} />;
}
