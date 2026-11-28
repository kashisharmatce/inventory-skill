import "server-only";
import { ApiError } from "@/lib/errors";
import { isBlank, isUuid } from "@/lib/validations";

const pad = (n) => String(n).padStart(2, "0");
const ALL_FROM = "2000-01-01";
const MODES = ["recent", "quarter", "month", "year", "all"];

/** Inclusive date range (YYYY-MM-DD) of a quarter: Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec. */
export function quarterBounds(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return { from: `${year}-${pad(startMonth)}-01`, to: `${year}-${pad(endMonth)}-${pad(lastDay)}` };
}

export function monthBounds(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export function currentQuarter(now = new Date()) {
  return { year: now.getUTCFullYear(), quarter: Math.floor(now.getUTCMonth() / 3) + 1, month: now.getUTCMonth() + 1 };
}

const isoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function intIn(value, min, max, message) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new ApiError(400, message);
  return n;
}

function mapDbError(error) {
  const message = error?.message || "";
  const detail = message.split(":").slice(1).join(":");
  const missing =
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    error?.code === "42883" ||
    error?.code === "42P01" ||
    (/get_audit_report|get_audit_range|record_stock_adjustment|stock_movements|audit_quarters/.test(message) &&
      /schema cache|does not exist|Could not find/.test(message));
  if (missing) {
    const needs0007 = /get_audit_range|record_stock_adjustment/.test(message);
    return new ApiError(
      503,
      needs0007
        ? "This part of the Audit Report is not set up yet. Run supabase/migrations/0007_audit_periods_and_adjustments.sql in the Supabase SQL Editor."
        : "The automatic audit report is not set up yet. Run supabase/migrations/0006_stock_ledger_and_quarterly_audit.sql (then 0007_audit_periods_and_adjustments.sql) in the Supabase SQL Editor."
    );
  }
  if (message.startsWith("INSUFFICIENT_STOCK:")) return new ApiError(400, `Insufficient stock for "${detail}" - you cannot scrap more than is in the inventory`);
  if (message.startsWith("PRODUCT_NOT_FOUND:")) return new ApiError(404, "Component not found");
  if (message.startsWith("INVALID:")) return new ApiError(400, message.slice("INVALID:".length));
  if (message.startsWith("UNAUTHORIZED:") || error?.code === "42501") return new ApiError(401, "Unauthorized access");
  return error;
}

const toRow = (r) => ({
  productId: r.product_id,
  productName: r.product_name,
  rowNo: r.row_no,
  opening: r.opening,
  addition: r.addition,
  utilised: r.utilised,
  scrap: r.scrap,
  closing: r.closing,
  issued: r.issued,
  returnedGood: r.returned_good,
  returnedDamaged: r.returned_damaged,
});

/**
 * The audit report for a period, calculated by the database from the permanent stock ledger.
 * mode: "recent" (the running quarter, latest data) | "quarter" | "month" | "year" | "all".
 * A finished QUARTER is saved the first time it is opened and never changes afterwards.
 */
export async function getReport(supabase, params = {}) {
  const now = currentQuarter();
  const mode = MODES.includes(params.mode) ? params.mode : "recent";
  const today = new Date().toISOString().slice(0, 10);

  let year = now.year;
  let quarter = now.quarter;
  let month = now.month;
  let from;
  let to;

  if (mode === "quarter") {
    year = intIn(params.year ?? now.year, 2000, 2100, "Choose a valid year");
    quarter = intIn(params.quarter ?? now.quarter, 1, 4, "Choose a quarter from 1 to 4");
    ({ from, to } = quarterBounds(year, quarter));
  } else if (mode === "month") {
    year = intIn(params.year ?? now.year, 2000, 2100, "Choose a valid year");
    month = intIn(params.month ?? now.month, 1, 12, "Choose a month from 1 to 12");
    ({ from, to } = monthBounds(year, month));
  } else if (mode === "year") {
    year = intIn(params.year ?? now.year, 2000, 2100, "Choose a valid year");
    from = `${year}-01-01`;
    to = `${year}-12-31`;
  } else if (mode === "all") {
    from = ALL_FROM;
    to = today;
  } else {
    ({ from, to } = quarterBounds(now.year, now.quarter)); // recent = the running quarter
  }

  const isQuarter = mode === "quarter" || mode === "recent";
  const { data, error } = isQuarter
    ? await supabase.rpc("get_audit_report", { p_year: year, p_quarter: quarter })
    : await supabase.rpc("get_audit_range", { p_from: from, p_to: to });
  if (error) throw mapDbError(error);

  const closed = to < today;
  let savedAt = null;
  if (isQuarter && closed) {
    const { data: saved } = await supabase
      .from("audit_quarters")
      .select("closed_at")
      .eq("report_year", year)
      .eq("report_quarter", quarter)
      .maybeSingle();
    savedAt = saved?.closed_at ?? null;
  }

  return {
    mode,
    year,
    quarter,
    month,
    from: mode === "all" ? null : from,
    to,
    closed,
    saved: isQuarter && closed, // finished quarters are kept as saved copies
    savedAt,
    generatedAt: new Date().toISOString(),
    rows: (data || []).map(toRow),
  };
}

/** The individual movements (purchases, issues, returns, scrap) of one component in a period. */
export async function listMovements(supabase, { from, to, productId, productName }) {
  if (!isoDate(from) || !isoDate(to)) throw new ApiError(400, "Choose a valid period");

  let query = supabase
    .from("stock_movements")
    .select("id, occurred_on, movement_type, quantity, user_name, note, created_at")
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: true })
    .order("created_at", { ascending: true });

  if (productId) {
    if (!isUuid(productId)) throw new ApiError(400, "Invalid component");
    query = query.eq("product_id", productId);
  } else if (productName) {
    query = query.is("product_id", null).eq("product_name", productName);
  } else {
    throw new ApiError(400, "Choose a component");
  }

  const { data, error } = await query;
  if (error) throw mapDbError(error);
  return data.map((m) => ({
    id: m.id,
    date: m.occurred_on,
    type: m.movement_type,
    quantity: m.quantity,
    userName: m.user_name,
    note: m.note,
  }));
}

/**
 * A manual stock adjustment (the Add button): a Purchase adds stock, a Scrap writes stock off.
 * It changes the Inventory stock and is written to the ledger, so it appears in the report of that period.
 */
export async function recordAdjustment(supabase, body) {
  if (!isUuid(body?.productId)) throw new ApiError(400, "Choose a component");
  if (body.type !== "purchase" && body.type !== "scrap") throw new ApiError(400, "Choose Purchase or Scrap");
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, "Quantity must be a whole number greater than 0");
  if (!isBlank(body.date) && !isoDate(String(body.date))) throw new ApiError(400, "The date is not valid");
  const reason = isBlank(body.reason) ? null : String(body.reason).trim();
  if (reason && reason.length > 200) throw new ApiError(400, "The reason must be 200 characters or fewer");

  const { error } = await supabase.rpc("record_stock_adjustment", {
    p_product_id: body.productId,
    p_type: body.type,
    p_quantity: quantity,
    p_on: isBlank(body.date) ? null : String(body.date),
    p_reason: reason,
  });
  if (error) throw mapDbError(error);
}
