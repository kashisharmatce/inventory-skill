import { CHART_DATA, DASHBOARD_CARDS, TRACKING_CARDS } from "@/lib/dummyData";

/**
 * Single seam for the summary cards / chart data.
 * Currently returns dummy data; swap the bodies for real Supabase queries later and the UI
 * does not need to change.
 */
export function getDashboardData() {
  return { cards: DASHBOARD_CARDS, chart: CHART_DATA };
}

export function getTrackingCards() {
  return TRACKING_CARDS;
}
