import "server-only";
import { isLowStock } from "@/lib/stock";
import { listProducts } from "./product.service";
import { listUsers } from "./user.service";
import { getReport } from "./auditReport.service";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 24 * 60 * 60 * 1000;

const dayStart = (value) => {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * Everything the Dashboard shows, from the real data: components, students' issued components,
 * the stock ledger (monthly activity, recent activity) and the running quarter of the Audit Report.
 * The ledger parts are optional: if the database setup for them has not been run yet they are left out.
 */
export async function getDashboard(supabase) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const todayStart = dayStart(now);

  const [products, users] = await Promise.all([listProducts(supabase), listUsers(supabase)]);

  // ---------- components ----------
  const stockValue = products.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0);
  const totalUnits = products.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const out = products.filter((p) => Number(p.quantity) <= 0);
  const low = products.filter((p) => Number(p.quantity) > 0 && isLowStock(p));
  const healthy = products.length - out.length - low.length;

  // components that have a minimum level (or are marked low) and need attention, most urgent first
  const attention = products
    .filter((p) => isLowStock(p))
    .map((p) => ({
      id: p.id,
      name: p.productName,
      quantity: Number(p.quantity) || 0,
      minimum: p.minimumStockLevel ?? null,
      manual: p.status === "low-stock",
    }))
    .sort((a, b) => a.quantity / Math.max(a.minimum ?? 1, 1) - b.quantity / Math.max(b.minimum ?? 1, 1))
    .slice(0, 8);

  // ---------- students ----------
  const issuedByComponent = new Map();
  const pending = [];
  let pendingUnits = 0;
  let pendingUsers = 0;
  for (const u of users) {
    let holds = false;
    for (const c of u.components) {
      const name = c.productName || "N/A";
      issuedByComponent.set(name, (issuedByComponent.get(name) || 0) + c.quantity);
      if (c.outstanding > 0) {
        holds = true;
        pendingUnits += c.outstanding;
        const dueStart = c.returnDate ? dayStart(c.returnDate) : null;
        pending.push({
          id: c.id,
          student: u.name,
          component: name,
          quantity: c.outstanding,
          dueDate: c.returnDate ?? null,
          daysLate: dueStart !== null && todayStart > dueStart ? Math.round((todayStart - dueStart) / DAY) : 0,
        });
      }
    }
    if (holds) pendingUsers += 1;
  }
  pending.sort((a, b) => b.daysLate - a.daysLate || String(a.dueDate).localeCompare(String(b.dueDate)));
  const mostIssued = [...issuedByComponent.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // ---------- ledger: monthly activity + recent activity + this quarter ----------
  let monthly = null;
  let recent = [];
  let quarter = null;

  const { data: moves, error: movesError } = await supabase
    .from("stock_movements")
    .select("occurred_on, movement_type, quantity")
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`);
  if (!movesError) {
    const purchases = Array(12).fill(0);
    const issued = Array(12).fill(0);
    const scrap = Array(12).fill(0);
    for (const m of moves) {
      const i = Number(String(m.occurred_on).slice(5, 7)) - 1;
      if (m.movement_type === "purchase") purchases[i] += m.quantity;
      else if (m.movement_type === "issue") issued[i] += m.quantity;
      else if (m.movement_type === "scrap" || m.movement_type === "return_damaged") scrap[i] += m.quantity;
    }
    monthly = { year, labels: MONTHS, purchases, issued, scrap };

    const { data: last } = await supabase
      .from("stock_movements")
      .select("id, occurred_on, movement_type, quantity, product_name, user_name, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    recent = (last || []).map((m) => ({
      id: m.id,
      date: m.occurred_on,
      type: m.movement_type,
      quantity: m.quantity,
      component: m.product_name,
      student: m.user_name,
    }));

    try {
      const report = await getReport(supabase, { mode: "recent" });
      const t = report.rows.reduce(
        (a, r) => ({
          opening: a.opening + r.opening,
          addition: a.addition + r.addition,
          utilised: a.utilised + r.utilised,
          scrap: a.scrap + r.scrap,
          closing: a.closing + r.closing,
        }),
        { opening: 0, addition: 0, utilised: 0, scrap: 0, closing: 0 }
      );
      quarter = { year: report.year, quarter: report.quarter, from: report.from, to: report.to, ...t };
    } catch {
      quarter = null;
    }
  }

  return {
    generatedAt: now.toISOString(),
    tiles: {
      components: products.length,
      units: totalUnits,
      stockValue,
      lowStock: low.length,
      outOfStock: out.length,
      pendingUsers,
      pendingUnits,
    },
    status: { healthy, low: low.length, out: out.length },
    attention,
    mostIssued,
    pending: pending.slice(0, 8),
    pendingTotal: pending.length,
    monthly,
    recent,
    quarter,
    ledgerReady: !movesError,
  };
}
