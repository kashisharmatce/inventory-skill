import "server-only";
import { ApiError } from "@/lib/errors";
import { isBlank, isUuid } from "@/lib/validations";
import { listProducts } from "./product.service";
import { getUserById, listUsers } from "./user.service";

const MODES = ["cash", "pay"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const isoDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function mapDbError(error) {
  const message = error?.message || "";
  const missing =
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    (/student_payments/.test(message) && /schema cache|does not exist/.test(message));
  if (missing)
    return new ApiError(
      503,
      "The Deposit page is not set up yet. Run supabase/migrations/0010_student_payments.sql in the Supabase SQL Editor."
    );
  if (error?.code === "23505") return new ApiError(400, "A deposit is already recorded for this student. Edit that record instead.");
  if (error?.code === "23514") return new ApiError(400, "Please check the amount, payment mode and refund date");
  if (error?.code === "42501") return new ApiError(401, "Unauthorized access");
  return error;
}

/** "YYYY-MM-DD" (UTC) of a timestamp given as text or as a Date, or null. */
function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** What the Tracking page knows about a student, in the shape the Deposit page needs. */
function studentDetails(user, priceById) {
  const lines = user.components.map((c) => `${c.productName || "N/A"} x ${c.quantity}`);
  const dates = user.components.map((c) => toIsoDate(c.issueAt)).filter(Boolean).sort();
  const value = user.components.reduce((sum, c) => sum + (Number(priceById.get(c.productId)) || 0) * c.quantity, 0);
  return {
    studentName: user.name,
    branch: user.branch || "",
    mobile: user.mobile || "",
    components: lines.join(", "),
    issuedOn: dates[0] ?? null,
    componentValue: value,
  };
}

const priceMap = (products) => new Map(products.map((p) => [p.id, p.price]));

const toPayment = (r, live) => ({
  id: r.id,
  userId: r.user_id,
  // live details from Tracking when the student still exists, else the copy saved with the deposit
  studentName: live?.studentName ?? r.student_name,
  branch: live ? live.branch : r.branch ?? "",
  mobile: live ? live.mobile : r.mobile ?? "",
  components: live ? live.components : r.components_text ?? "",
  issuedOn: live ? live.issuedOn : r.issued_on ?? null,
  amount: Number(r.amount),
  mode: r.pay_mode,
  refunded: r.refunded,
  refundedOn: r.refunded_on ?? null,
  note: r.note ?? "",
  studentDeleted: !live,
  createdAt: r.created_at,
});

/** All deposits, with the students' components, issue dates and details taken live from Tracking. */
export async function listPayments(supabase) {
  const { data, error } = await supabase.from("student_payments").select().order("created_at", { ascending: true });
  if (error) throw mapDbError(error);
  const [users, products] = await Promise.all([listUsers(supabase), listProducts(supabase)]);
  const prices = priceMap(products);
  const byId = new Map(users.map((u) => [u.id, studentDetails(u, prices)]));
  return data.map((r) => toPayment(r, r.user_id ? byId.get(r.user_id) : null));
}

/** Students from Tracking that do not have a deposit yet (for the Add form), with the value of their components. */
export async function listStudentsWithoutPayment(supabase) {
  const { data, error } = await supabase.from("student_payments").select("user_id");
  if (error) throw mapDbError(error);
  const taken = new Set(data.map((r) => r.user_id).filter(Boolean));
  const [users, products] = await Promise.all([listUsers(supabase), listProducts(supabase)]);
  const prices = priceMap(products);
  return users
    .filter((u) => !taken.has(u.id))
    .map((u) => ({ userId: u.id, ...studentDetails(u, prices) }));
}

function readFields(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isBlank(body.amount) || !Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter the amount (more than 0)");
    if (amount > 1e9) throw new ApiError(400, "The amount is too large");
    out.amount = Math.round(amount * 100) / 100;
  }
  if (!partial || body.mode !== undefined) {
    if (!MODES.includes(body.mode)) throw new ApiError(400, "Choose Cash or Pay");
    out.pay_mode = body.mode;
  }
  if (body.note !== undefined) {
    const note = isBlank(body.note) ? null : String(body.note).trim();
    if (note && note.length > 200) throw new ApiError(400, "The note must be 200 characters or fewer");
    out.note = note;
  }
  return out;
}

/** Records a deposit for a student. The amount, Cash / Pay and note are entered by hand. */
export async function createPayment(supabase, body) {
  if (!isUuid(body?.userId)) throw new ApiError(400, "Choose a student");
  const fields = readFields(body);
  const user = await getUserById(supabase, body.userId);
  const products = await listProducts(supabase);
  const d = studentDetails(user, priceMap(products));

  const { data, error } = await supabase
    .from("student_payments")
    .insert({
      user_id: user.id,
      student_name: d.studentName,
      branch: d.branch || null,
      mobile: d.mobile || null,
      components_text: d.components || null,
      issued_on: d.issuedOn,
      ...fields,
    })
    .select()
    .single();
  if (error) throw mapDbError(error);
  return toPayment(data, d);
}

async function findPayment(supabase, id) {
  if (!isUuid(id)) throw new ApiError(404, "Deposit not found");
  const { data, error } = await supabase.from("student_payments").select().eq("id", id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ApiError(404, "Deposit not found");
  return data;
}

/** Edits a deposit; { refunded: true } marks it as paid back (with today's date), { refunded: false } undoes that. */
export async function updatePayment(supabase, id, body) {
  const current = await findPayment(supabase, id);
  const fields = readFields(body, { partial: true });

  if (body.refunded !== undefined) {
    if (typeof body.refunded !== "boolean") throw new ApiError(400, "Refund must be ticked or not");
    if (body.refunded) {
      const on = isBlank(body.refundedOn) ? todayIso() : String(body.refundedOn);
      if (!isoDate(on)) throw new ApiError(400, "The refund date is not valid");
      if (on > todayIso()) throw new ApiError(400, "The refund date cannot be in the future");
      fields.refunded = true;
      fields.refunded_on = current.refunded && isBlank(body.refundedOn) ? current.refunded_on : on;
    } else {
      fields.refunded = false;
      fields.refunded_on = null;
    }
  }

  const { data, error } = await supabase.from("student_payments").update(fields).eq("id", id).select().single();
  if (error) throw mapDbError(error);

  let live = null;
  if (data.user_id) {
    try {
      const [user, products] = await Promise.all([getUserById(supabase, data.user_id), listProducts(supabase)]);
      live = studentDetails(user, priceMap(products));
    } catch {
      live = null;
    }
  }
  return toPayment(data, live);
}

export async function deletePayment(supabase, id) {
  await findPayment(supabase, id);
  const { error } = await supabase.from("student_payments").delete().eq("id", id);
  if (error) throw mapDbError(error);
}
