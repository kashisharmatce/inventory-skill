import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createUser, listUsers } from "@/services/user.service";

export const dynamic = "force-dynamic";

// GET /api/user
export const GET = handle(async () => {
  const { supabase } = await requireAdmin();
  const data = await listUsers(supabase);
  return json({ status: true, msg: "User Data", data });
});

// POST /api/user  (creates the user + components and deducts stock atomically)
export const POST = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const data = await createUser(supabase, await readJson(request));
  return json({ status: true, msg: "User Created Successfully", data }, 201);
});
