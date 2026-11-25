import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { deleteProduct, getProductById, updateProduct } from "@/services/product.service";

export const dynamic = "force-dynamic";

// GET /api/storage/:id
export const GET = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await getProductById(supabase, id);
  return json({ status: true, data });
});

// PUT /api/storage/:id
export const PUT = handle(async (request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const data = await updateProduct(supabase, id, await readJson(request));
  return json({ status: true, message: "Product updated successfully", data });
});

// DELETE /api/storage/:id
export const DELETE = handle(async (_request, { params }) => {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  await deleteProduct(supabase, id);
  return json({ status: true, message: "Product deleted successfully" });
});
