import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getReport } from "@/services/auditReport.service";

export const dynamic = "force-dynamic";

// GET /api/audit?mode=recent|quarter|month|year|all&year=2026&quarter=4&month=11   (default: the running quarter)
export const GET = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const data = await getReport(supabase, params);
  return json({ status: true, data });
});
