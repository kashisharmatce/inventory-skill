import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { deletePayment, updatePayment } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

// PUT /api/payment/:id   { amount?, mode?, team?, note?, refunded? }
export const PUT = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await updatePayment(supabase, id, await readJson(request));
  return json({ status: true, message: "Deposit updated successfully", data });
});

// DELETE /api/payment/:id
export const DELETE = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  await deletePayment(supabase, id);
  return json({ status: true, message: "Deposit deleted successfully" });
});
