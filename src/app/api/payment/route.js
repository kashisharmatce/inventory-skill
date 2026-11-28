import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createPayment, listPayments } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

// GET /api/payment   -> all deposits (student details, components and issue dates come live from Tracking)
export const GET = handle(async () => {
  const { supabase } = await requireAdmin();
  return json({ status: true, data: await listPayments(supabase) });
});

// POST /api/payment   { userId, amount, mode: "cash" | "pay", team?, note? }
export const POST = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const data = await createPayment(supabase, await readJson(request));
  return json({ status: true, message: "Deposit recorded successfully", data }, 201);
});
