// Small helper used by the Tracking page cards.

/** Component issued the most (by total quantity) across all users: { name, qty } or null. */
export function mostIssuedItem(users) {
  const totals = new Map();
  for (const u of users)
    for (const c of u.components || []) {
      const name = c.productName || "N/A";
      totals.set(name, (totals.get(name) || 0) + (Number(c.quantity) || 0));
    }
  let best = null;
  for (const [name, qty] of totals) if (!best || qty > best.qty) best = { name, qty };
  return best;
}
