import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { deleteAudit, getAuditById, updateAudit } from "@/services/audit.service";

export const dynamic = "force-dynamic";

// GET /api/audit/:id
export const GET = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  return json({ status: true, data: await getAuditById(supabase, id) });
});

// PUT /api/audit/:id
export const PUT = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await updateAudit(supabase, id, await readJson(request));
  return json({ status: true, message: "Audit record updated successfully", data });
});

// DELETE /api/audit/:id
export const DELETE = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  await deleteAudit(supabase, id);
  return json({ status: true, message: "Audit record deleted successfully" });
});
