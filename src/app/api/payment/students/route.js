import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { listStudentsWithoutPayment } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

// GET /api/payment/students   -> students from Tracking that have no deposit yet
export const GET = handle(async () => {
  const { supabase } = await requireAdmin();
  return json({ status: true, data: await listStudentsWithoutPayment(supabase) });
});
