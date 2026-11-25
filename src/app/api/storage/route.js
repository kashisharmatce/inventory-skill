import { handle, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { createProduct, listProducts } from "@/services/product.service";

export const dynamic = "force-dynamic";

// GET /api/storage
export const GET = handle(async () => {
  const { supabase } = await requireAdmin();
  const data = await listProducts(supabase);
  return json({ status: true, data });
});

// POST /api/storage
export const POST = handle(async (request) => {
  const { supabase } = await requireAdmin();
  const data = await createProduct(supabase, await readJson(request));
  return json({ status: true, message: "Product created successfully", data }, 201);
});
