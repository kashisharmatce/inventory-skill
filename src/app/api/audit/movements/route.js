import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { listMovements } from "@/services/auditReport.service";

export const dynamic = "force-dynamic";

// GET /api/audit/movements?from=2026-10-01&to=2026-12-31&productId=<uuid>   (or &productName=<name> for deleted components)
export const GET = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const params = new URL(request.url).searchParams;
  const data = await listMovements(supabase, {
    from: params.get("from"),
    to: params.get("to"),
    productId: params.get("productId") || undefined,
    productName: params.get("productName") || undefined,
  });
  return json({ status: true, data });
});
