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

const toUser = (r) => {
  const components = (r.user_components || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((c) => {
      const returnedGood = c.returned_good ?? 0;
      const returnedDamaged = c.returned_damaged ?? 0;
      return {
        id: c.id,
        productId: c.product_id,
        productName: c.product_name,
        quantity: c.quantity,
        issueAt: c.issue_at,
        returnDate: c.return_date,
        returnedGood,
        returnedDamaged,
        outstanding: c.quantity - returnedGood - returnedDamaged,
        returnedAt: c.returned_at ?? null,
      };
    });
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    mobile: r.mobile,
    USN: r.usn,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    components,
    outstanding: components.reduce((sum, c) => sum + c.outstanding, 0),
  };
};

/** Validates + converts the components of a NEW user into the JSON the SQL function expects. */
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

/** Edits of ALREADY issued components (matched by id): quantity and dates only. */
function normalizeEditedComponents(components) {
  return components.map((c) => {
    if (!isUuid(c?.id)) throw new ApiError(400, "Component id is required to edit a component");
    const quantity = isBlank(c.quantity) ? null : Number(c.quantity);
    if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0))
      throw new ApiError(400, "Quantity must be a whole number greater than 0");
    return {
      component_id: c.id,
      quantity,
      issue_at: isBlank(c.issueAt) ? null : c.issueAt,
      return_date: isBlank(c.returnDate) ? null : c.returnDate,
    };
  });
}

/** Maps errors raised by the SQL functions ('CODE:detail') and unique violations to API errors. */
function mapDbError(error) {
  const message = error?.message || "";
  const detail = message.split(":").slice(1).join(":");
  if (error?.code === "23505") {
    if (/email/.test(message)) return new ApiError(400, "this email already exist");
    if (/usn/.test(message)) return new ApiError(400, "this USN already exist");
    if (/mobile/.test(message)) return new ApiError(400, "this mobile already exist");
    return new ApiError(400, "Duplicate value");
  }
  if (message.startsWith("INSUFFICIENT_STOCK:")) return new ApiError(400, `Insufficient stock for "${detail}"`);
  if (message.startsWith("PRODUCT_NOT_FOUND:")) return new ApiError(404, `Product not found: ${detail}`);
  if (message.startsWith("ALREADY_RETURNED:")) return new ApiError(400, `"${detail}" has already been returned`);
  if (message.startsWith("HAS_OUTSTANDING:"))
    return new ApiError(
      400,
      `This user still has ${detail} unreturned component(s). Process the return first, then delete the user.`
    );
  if (message.startsWith("INVALID:")) return new ApiError(400, message.slice("INVALID:".length));
  if (message.startsWith("UNAUTHORIZED:")) return new ApiError(401, "Unauthorized access");
  if (message.startsWith("NOT_FOUND:component")) return new ApiError(404, "Component not found");
  if (message.startsWith("NOT_FOUND:")) return new ApiError(404, "User not found");
  // the database setup of the stock ledger (0006) has not been run yet
  if (error?.code === "PGRST202" || error?.code === "42883" || /return_components/.test(message) && /schema cache|does not exist/.test(message))
    return new ApiError(
      503,
      "Returns are not set up yet. Run supabase/migrations/0006_stock_ledger_and_quarterly_audit.sql in the Supabase SQL Editor."
    );
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
 * `create_tracked_user`); every issued component is also written to the stock ledger.
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
  if (status === "returned") throw new ApiError(400, "A new user cannot be created as returned");

  const cleaned = {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    mobile: String(mobile).trim(),
    usn: String(USN).trim(),
  };
  const normalized = normalizeComponents(components);

  // Only the email must be unique; the same mobile number or USN may be used for several users.
  await assertUnique(supabase, { email: cleaned.email });

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
  await assertUnique(supabase, { email: fields.email }, id);

  const { error } = await supabase.rpc("update_tracked_user", {
    p_id: id,
    p_name: fields.name,
    p_email: fields.email,
    p_mobile: fields.mobile,
    p_usn: fields.usn,
    p_status: body.status ?? null,
    p_components: body.components === undefined ? null : normalizeEditedComponents(body.components),
  });
  if (error) throw mapDbError(error);

  return getUserById(supabase, id);
}

/**
 * Processes a return: body = { items: [{ componentId, quantity, condition: "good" | "damaged" }] }.
 * Good items go back into the inventory; damaged items do not, and are recorded as scrap.
 */
export async function returnComponents(supabase, id, body) {
  await assertExists(supabase, id);
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, "Choose at least one component to return");

  const normalized = items.map((it) => {
    const quantity = Number(it?.quantity);
    if (!isUuid(it?.componentId)) throw new ApiError(400, "Component id is required");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, "Return quantity must be a whole number greater than 0");
    if (it.condition !== "good" && it.condition !== "damaged")
      throw new ApiError(400, "Select the condition of the returned component: Good or Damaged");
    return { component_id: it.componentId, quantity, condition: it.condition };
  });

  const { error } = await supabase.rpc("return_components", { p_user_id: id, p_items: normalized });
  if (error) throw mapDbError(error);

  return getUserById(supabase, id);
}

export async function deleteUser(supabase, id) {
  await assertExists(supabase, id);
  const { error } = await supabase.from("tracked_users").delete().eq("id", id);
  if (error) throw mapDbError(error);
}
