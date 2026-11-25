import "server-only";
import { ApiError } from "@/lib/errors";
import { isBlank, isUuid } from "@/lib/validations";

const toProduct = (r) => ({
  id: r.id,
  productName: r.product_name,
  category: r.category,
  description: r.description,
  quantity: r.quantity,
  price: r.price,
  purchaseDate: r.purchase_date,
  warrantyCheck: r.warranty_check,
  minimumStockLevel: r.minimum_stock_level,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toNumber = (value, label, { integer = false } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)))
    throw new ApiError(400, `${label} must be a valid ${integer ? "whole " : ""}number`);
  return n;
};

/** Maps the (whitelisted) request body to DB columns. Empty optional values become NULL. */
function toColumns(body) {
  const cols = {};
  if (body.productName !== undefined) cols.product_name = String(body.productName).trim();
  if (body.category !== undefined) cols.category = String(body.category).trim();
  if (body.description !== undefined) cols.description = body.description ?? "";
  if (body.quantity !== undefined) cols.quantity = toNumber(body.quantity, "Quantity", { integer: true });
  if (body.price !== undefined)
    cols.price = isBlank(body.price) ? null : toNumber(body.price, "Price");
  if (body.purchaseDate !== undefined)
    cols.purchase_date = isBlank(body.purchaseDate) ? null : String(body.purchaseDate).slice(0, 10);
  if (body.warrantyCheck !== undefined)
    cols.warranty_check = isBlank(body.warrantyCheck) ? null : String(body.warrantyCheck);
  if (body.minimumStockLevel !== undefined)
    cols.minimum_stock_level = isBlank(body.minimumStockLevel)
      ? null
      : toNumber(body.minimumStockLevel, "Minimum stock level", { integer: true });
  return cols;
}

export async function createProduct(supabase, body) {
  if (isBlank(body.productName)) throw new ApiError(400, "Product name is required");
  if (isBlank(body.category)) throw new ApiError(400, "Category is required");
  if (isBlank(body.price)) throw new ApiError(400, "Price is required");
  if (isBlank(body.quantity)) throw new ApiError(400, "Please add quantity");

  const { data, error } = await supabase.from("products").insert(toColumns(body)).select().single();
  if (error) throw error;
  return toProduct(data);
}

export async function listProducts(supabase) {
  const { data, error } = await supabase
    .from("products")
    .select()
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(toProduct);
}

async function findProduct(supabase, id) {
  if (!isUuid(id)) throw new ApiError(404, "Product not found");
  const { data, error } = await supabase.from("products").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Product not found");
  return data;
}

export async function getProductById(supabase, id) {
  return toProduct(await findProduct(supabase, id));
}

export async function updateProduct(supabase, id, body) {
  await findProduct(supabase, id);

  const columns = toColumns(body);
  if (columns.product_name === "") throw new ApiError(400, "Product name is required");
  if (columns.category === "") throw new ApiError(400, "Category is required");

  const { data, error } = await supabase
    .from("products")
    .update(columns)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toProduct(data);
}

export async function deleteProduct(supabase, id) {
  await findProduct(supabase, id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
