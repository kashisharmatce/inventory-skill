import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { deleteUser, getUserById, updateUser } from "@/services/user.service";

export const dynamic = "force-dynamic";

// GET /api/user/:id
export const GET = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await getUserById(supabase, id);
  return json({ status: true, data });
});

// PUT /api/user/:id
export const PUT = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await updateUser(supabase, id, await readJson(request));
  return json({ status: true, message: "User details updated successfully", data });
});

// DELETE /api/user/:id
export const DELETE = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  await deleteUser(supabase, id);
  return json({ status: true, message: "User details deleted successfully" });
});
