import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createAudit, listAudit } from "@/services/audit.service";

export const dynamic = "force-dynamic";

// GET /api/audit?from=YYYY-MM-DD&to=YYYY-MM-DD   (both optional)
export const GET = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const params = new URL(request.url).searchParams;
  const data = await listAudit(supabase, {
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  });
  return json({ status: true, data });
});

// POST /api/audit
export const POST = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const data = await createAudit(supabase, await readJson(request));
  return json({ status: true, message: "Audit record created successfully", data }, 201);
});
