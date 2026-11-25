import "server-only";
import { ApiError } from "@/lib/errors";
import { isUuid } from "@/lib/validations";
import { ALLOWED_TYPES, MAX_FILES_PER_PRODUCT, MAX_FILE_BYTES, checkFile, extensionOf } from "@/lib/attachments";

const META = "id, product_id, file_name, mime_type, size_bytes, created_at";

const toMeta = (r) => ({
  id: r.id,
  productId: r.product_id,
  fileName: r.file_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

function mapDbError(error) {
  const message = error?.message || "";
  const missing =
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    (/product_files/.test(message) && /schema cache|does not exist/.test(message));
  if (missing)
    return new ApiError(
      503,
      "File attachments are not set up yet. Run supabase/migrations/0003_product_status_and_files.sql in the Supabase SQL Editor."
    );
  if (error?.code === "23503") return new ApiError(404, "Product not found");
  if (error?.code === "42501") return new ApiError(401, "Unauthorized access");
  return error;
}

const cleanName = (name) =>
  String(name || "file")
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f"<>|:*?]/g, "_")
    .slice(0, 150) || "file";

async function assertProduct(supabase, productId) {
  if (!isUuid(productId)) throw new ApiError(404, "Product not found");
  const { data, error } = await supabase.from("products").select("id").eq("id", productId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Product not found");
}

export async function listFiles(supabase, productId) {
  await assertProduct(supabase, productId);
  const { data, error } = await supabase
    .from("product_files")
    .select(META)
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (error) throw mapDbError(error);
  return data.map(toMeta);
}

/** Validates and stores one uploaded file (a web `File` from multipart form data). */
export async function addFile(supabase, productId, file) {
  await assertProduct(supabase, productId);
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError(400, "No file was uploaded");

  const problem = checkFile(file);
  if (problem) throw new ApiError(400, problem);

  const { count, error: countError } = await supabase
    .from("product_files")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (countError) throw mapDbError(countError);
  if ((count ?? 0) >= MAX_FILES_PER_PRODUCT)
    throw new ApiError(400, `A product can have at most ${MAX_FILES_PER_PRODUCT} attachments`);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) throw new ApiError(400, "File size is not allowed");

  const { data, error } = await supabase
    .from("product_files")
    .insert({
      product_id: productId,
      file_name: cleanName(file.name),
      mime_type: ALLOWED_TYPES[extensionOf(file.name)], // from our allow-list, never from the client
      size_bytes: buffer.length,
      data_base64: buffer.toString("base64"),
    })
    .select(META)
    .single();
  if (error) throw mapDbError(error);
  return toMeta(data);
}

async function findFile(supabase, productId, fileId, columns) {
  if (!isUuid(productId) || !isUuid(fileId)) throw new ApiError(404, "File not found");
  const { data, error } = await supabase
    .from("product_files")
    .select(columns)
    .eq("id", fileId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ApiError(404, "File not found");
  return data;
}

/** Returns { fileName, mimeType, buffer } for downloading / previewing. */
export async function getFileContent(supabase, productId, fileId) {
  const r = await findFile(supabase, productId, fileId, `${META}, data_base64`);
  return { fileName: r.file_name, mimeType: r.mime_type, buffer: Buffer.from(r.data_base64, "base64") };
}

export async function deleteFile(supabase, productId, fileId) {
  await findFile(supabase, productId, fileId, "id");
  const { error } = await supabase.from("product_files").delete().eq("id", fileId);
  if (error) throw mapDbError(error);
}
