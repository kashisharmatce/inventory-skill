import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { recordAdjustment } from "@/services/auditReport.service";

export const dynamic = "force-dynamic";

// POST /api/audit/adjustments   { productId, type: "purchase" | "scrap", quantity, date?, reason? }
export const POST = handle(async (request) => {
  const { supabase } = await requireAdmin();
  await recordAdjustment(supabase, await readJson(request));
  return json({ status: true, message: "Stock adjustment recorded" }, 201);
});
