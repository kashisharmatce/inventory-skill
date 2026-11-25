// Date-range helpers for the Audit Report filters (monthly / quarterly / yearly).

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const QUARTERS = [
  { value: 1, label: "Q1 (Jan - Mar)" },
  { value: 2, label: "Q2 (Apr - Jun)" },
  { value: 3, label: "Q3 (Jul - Sep)" },
  { value: 4, label: "Q4 (Oct - Dec)" },
];

const pad = (n) => String(n).padStart(2, "0");
const lastDay = (year, month) => new Date(year, month, 0).getDate(); // month is 1-12

/**
 * Converts the filter selection to an inclusive { from, to } range of YYYY-MM-DD strings.
 * mode: "all" | "monthly" | "quarterly" | "yearly". "all" returns no limits.
 */
export function getDateRange({ mode, year, month, quarter }) {
  const y = Number(year);
  if (mode === "monthly") {
    const m = Number(month);
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  }
  if (mode === "quarterly") {
    const startMonth = (Number(quarter) - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return { from: `${y}-${pad(startMonth)}-01`, to: `${y}-${pad(endMonth)}-${pad(lastDay(y, endMonth))}` };
  }
  if (mode === "yearly") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return {};
}

/** Human readable name of the current selection, used in titles and the export file name. */
export function describeFilter({ mode, year, month, quarter }) {
  if (mode === "monthly") return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
  if (mode === "quarterly") return `Q${quarter} ${year}`;
  if (mode === "yearly") return `${year}`;
  return "All records";
}
