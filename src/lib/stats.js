// Summary numbers calculated from the real users (with their issued components) and products.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const top = (map) => {
  let best = null;
  for (const [name, qty] of map) if (!best || qty > best.qty) best = { name, qty };
  return best;
};

/** Product issued the most (by total quantity) across all users. */
export function mostIssuedItem(users) {
  const totals = new Map();
  for (const u of users)
    for (const c of u.components || [])
      totals.set(c.productName || "N/A", (totals.get(c.productName || "N/A") || 0) + (Number(c.quantity) || 0));
  return top(totals);
}

/** User holding the most issued items (by total quantity). */
export function topUser(users) {
  const totals = new Map();
  for (const u of users) {
    const qty = (u.components || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
    if (qty > 0) totals.set(u.name, qty);
  }
  return top(totals);
}

/** Units issued per month of the current year (index 0 = January). */
export function monthlyIssued(users, year = new Date().getFullYear()) {
  const values = Array(12).fill(0);
  for (const u of users)
    for (const c of u.components || []) {
      const d = c.issueAt ? new Date(c.issueAt) : null;
      if (d && !Number.isNaN(d.getTime()) && d.getFullYear() === year)
        values[d.getMonth()] += Number(c.quantity) || 0;
    }
  return { label: `Components issued in ${year}`, labels: MONTHS, values };
}

export const describeTop = (t, unit = "issued") => (t ? `${t.name} (${t.qty} ${unit})` : "No data yet");
