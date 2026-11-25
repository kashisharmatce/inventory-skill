import "server-only";
import { ApiError } from "@/lib/errors";
import {
  isBlank,
  isUuid,
  isValidEmail,
  isValidMobile,
  isValidStatus,
  USER_STATUSES,
} from "@/lib/validations";

const SELECT = "*, user_components(*)";

const toUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  mobile: r.mobile,
  USN: r.usn,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  components: (r.user_components || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((c) => ({
      id: c.id,
      productId: c.product_id,
      productName: c.product_name,
      quantity: c.quantity,
      issueAt: c.issue_at,
      returnDate: c.return_date,
    })),
});

/** Validates + converts the components array into the JSON the SQL functions expect. */
function normalizeComponents(components) {
  return components.map((c) => {
    const quantity = Number(c?.quantity);
    if ((isBlank(c?.productId) && isBlank(c?.productName)) || !Number.isInteger(quantity) || quantity <= 0)
      throw new ApiError(400, "Please enter component name and a quantity greater than 0");
    return {
      product_id: isBlank(c.productId) ? null : c.productId,
      product_name: isBlank(c.productName) ? null : c.productName,
      quantity,
      issue_at: isBlank(c.issueAt) ? null : c.issueAt,
      return_date: isBlank(c.returnDate) ? null : c.returnDate,
    };
  });
}

/** Maps errors raised by the SQL functions ('CODE:detail') and unique violations to API errors. */
function mapDbError(error) {
  const message = error?.message || "";
  if (error?.code === "23505") {
    if (/email/.test(message)) return new ApiError(400, "this email already exist");
    if (/usn/.test(message)) return new ApiError(400, "this USN already exist");
    if (/mobile/.test(message)) return new ApiError(400, "this mobile already exist");
    return new ApiError(400, "Duplicate value");
  }
  if (message.startsWith("INSUFFICIENT_STOCK:"))
    return new ApiError(400, `Insufficient stock for "${message.split(":").slice(1).join(":")}"`);
  if (message.startsWith("PRODUCT_NOT_FOUND:"))
    return new ApiError(404, `Product not found: ${message.split(":").slice(1).join(":")}`);
  if (message.startsWith("INVALID:"))
    return new ApiError(400, message.slice("INVALID:".length));
  if (message.startsWith("UNAUTHORIZED:")) return new ApiError(401, "Unauthorized access");
  if (message.startsWith("NOT_FOUND:")) return new ApiError(404, "User not found");
  return error;
}

async function assertUnique(supabase, { email, usn, mobile }, excludeId) {
  const checks = [
    ["email", email, "this email already exist", (q, v) => q.eq("email", v.toLowerCase())],
    ["usn", usn, "this USN already exist", (q, v) => q.eq("usn", v)],
    ["mobile", mobile, "this mobile already exist", (q, v) => q.eq("mobile", v)],
  ];
  for (const [, value, message, apply] of checks) {
    if (isBlank(value)) continue;
    let query = apply(supabase.from("tracked_users").select("id"), String(value).trim());
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    if (data.length > 0) throw new ApiError(400, message);
  }
}

export async function listUsers(supabase) {
  const { data, error } = await supabase
    .from("tracked_users")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(toUser);
}

export async function getUserById(supabase, id) {
  if (!isUuid(id)) throw new ApiError(404, "User not found");
  const { data, error } = await supabase
    .from("tracked_users")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "User not found");
  return toUser(data);
}

/**
 * Creates the user, their components and deducts stock atomically (SQL function
 * `create_tracked_user`). Validation + messages follow the original createUser.
 */
export async function createUser(supabase, body) {
  const { name, email, mobile, USN, components } = body;
  const status = body.status;

  if (isBlank(name)) throw new ApiError(400, "user name is required");
  if (isBlank(email)) throw new ApiError(400, "email is required");
  if (!isValidEmail(email)) throw new ApiError(400, "Invalid Email");
  if (isBlank(mobile)) throw new ApiError(400, "mobile is required");
  if (!isValidMobile(mobile)) throw new ApiError(400, "Enter the valid mobile");
  if (isBlank(USN)) throw new ApiError(400, "USN is required");
  if (!Array.isArray(components) || components.length === 0)
    throw new ApiError(400, "Component details are required and cannot be empty");
  if (!isValidStatus(status))
    throw new ApiError(400, `Status must be one of ${USER_STATUSES.map((s) => `'${s}'`).join(", ")}`);

  const cleaned = {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    mobile: String(mobile).trim(),
    usn: String(USN).trim(),
  };
  const normalized = normalizeComponents(components);

  await assertUnique(supabase, cleaned);

  const { data: id, error } = await supabase.rpc("create_tracked_user", {
    p_name: cleaned.name,
    p_email: cleaned.email,
    p_mobile: cleaned.mobile,
    p_usn: cleaned.usn,
    p_status: status,
    p_components: normalized,
  });
  if (error) throw mapDbError(error);

  return getUserById(supabase, id);
}

async function assertExists(supabase, id) {
  if (!isUuid(id)) throw new ApiError(404, "User not found");
  const { data, error } = await supabase
    .from("tracked_users")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "User not found");
}

export async function updateUser(supabase, id, body) {
  await assertExists(supabase, id);

  if (body.name !== undefined && isBlank(body.name)) throw new ApiError(400, "user name is required");
  if (body.email !== undefined && !isValidEmail(body.email)) throw new ApiError(400, "Invalid Email");
  if (body.mobile !== undefined && !isValidMobile(body.mobile)) throw new ApiError(400, "Enter the valid mobile");
  if (body.USN !== undefined && isBlank(body.USN)) throw new ApiError(400, "USN is required");
  if (body.status !== undefined && !isValidStatus(body.status))
    throw new ApiError(400, `Status must be one of ${USER_STATUSES.map((s) => `'${s}'`).join(", ")}`);
  if (body.components !== undefined && (!Array.isArray(body.components) || body.components.length === 0))
    throw new ApiError(400, "Component details are required and cannot be empty");

  const fields = {
    name: body.name === undefined ? null : String(body.name).trim(),
    email: body.email === undefined ? null : String(body.email).trim().toLowerCase(),
    mobile: body.mobile === undefined ? null : String(body.mobile).trim(),
    usn: body.USN === undefined ? null : String(body.USN).trim(),
  };
  await assertUnique(supabase, fields, id);

  const { error } = await supabase.rpc("update_tracked_user", {
    p_id: id,
    p_name: fields.name,
    p_email: fields.email,
    p_mobile: fields.mobile,
    p_usn: fields.usn,
    p_status: body.status ?? null,
    p_components: body.components === undefined ? null : normalizeComponents(body.components),
  });
  if (error) throw mapDbError(error);

  return getUserById(supabase, id);
}

export async function deleteUser(supabase, id) {
  await assertExists(supabase, id);
  const { error } = await supabase.from("tracked_users").delete().eq("id", id);
  if (error) throw error;
}
