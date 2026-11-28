import "server-only";
import { ApiError } from "@/lib/errors";
import { isBlank, isUuid } from "@/lib/validations";

const toProduct = (r) => ({
  id: r.id,
  productName: r.product_name,
  description: r.description,
  quantity: r.quantity,
  price: r.price,
  purchaseDate: r.purchase_date,
  warrantyCheck: r.warranty_check,
  minimumStockLevel: r.minimum_stock_level,
  status: r.status ?? null,
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
  if (body.status !== undefined) {
    if (isBlank(body.status)) cols.status = null;
    else if (["in-stock", "low-stock"].includes(body.status)) cols.status = body.status;
    else throw new ApiError(400, "Status must be In-Stock, Low-Stock or Auto");
  }
  return cols;
}

/** One component per name (any capitalisation): stops the same item being added - and its stock counted - twice. */
async function assertNameFree(supabase, name, excludeId) {
  const pattern = name.replace(/[\\%_]/g, (m) => "\\" + m);
  let query = supabase.from("products").select("id, product_name").ilike("product_name", pattern).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  if (data.length > 0)
    throw new ApiError(400, `"${data[0].product_name}" already exists in the inventory. Open it and edit the quantity to add stock.`);
}

function mapProductError(error) {
  if (error?.code === "23505" && /products_name_unique|product_name/.test(error.message || ""))
    return new ApiError(400, "A component with this name already exists in the inventory");
  return error;
}

export async function createProduct(supabase, body) {
  if (isBlank(body.productName)) throw new ApiError(400, "Product name is required");
  if (isBlank(body.price)) throw new ApiError(400, "Price is required");
  if (isBlank(body.quantity)) throw new ApiError(400, "Please add quantity");

  await assertNameFree(supabase, String(body.productName).trim());

  const { data, error } = await supabase.from("products").insert({ category: "", ...toColumns(body) }).select().single();
  if (error) throw mapProductError(error);
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
  if (columns.product_name) await assertNameFree(supabase, columns.product_name, id);

  const { data, error } = await supabase
    .from("products")
    .update(columns)
    .eq("id", id)
    .select()
    .single();
  if (error) throw mapProductError(error);
  return toProduct(data);
}

export async function deleteProduct(supabase, id) {
  await findProduct(supabase, id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
