import "server-only";
import { ApiError } from "@/lib/errors";
import { isBlank, isUuid } from "@/lib/validations";

const toRecord = (r) => ({
  id: r.id,
  auditDate: r.audit_date,
  particulars: r.particulars,
  opBalance: r.op_balance,
  addition: r.addition,
  utilised: r.utilised,
  scrap: r.scrap,
  closingStock: r.closing_stock,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const isRealDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const toCount = (value, label) => {
  if (isBlank(value)) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new ApiError(400, `${label} must be a whole number (0 or more)`);
  return n;
};

/** Validates the request body and maps it to DB columns. `partial` allows missing fields (updates). */
function toColumns(body, { partial = false } = {}) {
  const cols = {};

  if (!partial || body.auditDate !== undefined) {
    if (isBlank(body.auditDate)) throw new ApiError(400, "Audit date is required");
    const date = String(body.auditDate).slice(0, 10);
    if (!isRealDate(date)) throw new ApiError(400, "Audit date is not a valid date");
    cols.audit_date = date;
  }
  if (!partial || body.particulars !== undefined) {
    if (isBlank(body.particulars)) throw new ApiError(400, "Particulars is required");
    cols.particulars = String(body.particulars).trim();
    if (cols.particulars.length > 200) throw new ApiError(400, "Particulars must be 200 characters or fewer");
  }
  for (const [key, col, label] of [
    ["opBalance", "op_balance", "OP Bal"],
    ["addition", "addition", "Addition (Purchases)"],
    ["utilised", "utilised", "Utilised"],
    ["scrap", "scrap", "Scrap"],
  ]) {
    if (!partial || body[key] !== undefined) cols[col] = toCount(body[key], label);
  }
  return cols;
}

/** Turns database errors into friendly API errors. */
function mapDbError(error) {
  const message = error?.message || "";
  const missingTable =
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    (/audit_records/.test(message) && /schema cache|does not exist/.test(message));
  if (missingTable)
    return new ApiError(
      503,
      "The audit_records table does not exist yet. Run supabase/migrations/0002_audit_report.sql in the Supabase SQL Editor."
    );
  if (error?.code === "23514")
    return new ApiError(400, "Utilised + Scrap cannot be more than OP Bal + Addition (closing stock would be negative)");
  if (error?.code === "42501") return new ApiError(401, "Unauthorized access");
  return error;
}

/** Lists records, optionally limited to an audit-date range (inclusive). */
export async function listAudit(supabase, { from, to } = {}) {
  if (from && !isRealDate(from)) throw new ApiError(400, "Invalid 'from' date");
  if (to && !isRealDate(to)) throw new ApiError(400, "Invalid 'to' date");

  let query = supabase
    .from("audit_records")
    .select()
    .order("audit_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (from) query = query.gte("audit_date", from);
  if (to) query = query.lte("audit_date", to);

  const { data, error } = await query;
  if (error) throw mapDbError(error);
  return data.map(toRecord);
}

async function findRecord(supabase, id) {
  if (!isUuid(id)) throw new ApiError(404, "Audit record not found");
  const { data, error } = await supabase.from("audit_records").select().eq("id", id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ApiError(404, "Audit record not found");
  return data;
}

export async function getAuditById(supabase, id) {
  return toRecord(await findRecord(supabase, id));
}

export async function createAudit(supabase, body) {
  const { data, error } = await supabase.from("audit_records").insert(toColumns(body)).select().single();
  if (error) throw mapDbError(error);
  return toRecord(data);
}

export async function updateAudit(supabase, id, body) {
  await findRecord(supabase, id);
  const { data, error } = await supabase
    .from("audit_records")
    .update(toColumns(body, { partial: true }))
    .eq("id", id)
    .select()
    .single();
  if (error) throw mapDbError(error);
  return toRecord(data);
}

export async function deleteAudit(supabase, id) {
  await findRecord(supabase, id);
  const { error } = await supabase.from("audit_records").delete().eq("id", id);
  if (error) throw mapDbError(error);
}
