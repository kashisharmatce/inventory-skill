import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { returnComponents } from "@/services/user.service";

export const dynamic = "force-dynamic";

// POST /api/user/:id/return   { items: [{ componentId, quantity, condition: "good" | "damaged" }] }
export const POST = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await returnComponents(supabase, id, await readJson(request));
  return json({ status: true, message: "Return processed successfully", data });
});
