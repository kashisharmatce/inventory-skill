import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/services/dashboard.service";

export const dynamic = "force-dynamic";

// GET /api/dashboard  -> tiles, charts and lists for the Dashboard page
export const GET = handle(async () => {
  const { supabase } = await requireAdmin();
  return json({ status: true, data: await getDashboard(supabase) });
});
