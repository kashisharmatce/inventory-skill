/** Parses 'YYYY-MM-DD' as a LOCAL date (avoids the off-by-one-day UTC shift) or any ISO timestamp. */
function parse(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Locale date for display, or "" when there is no value. */
export function formatDate(value) {
  const date = parse(value);
  return date ? date.toLocaleDateString() : "";
}

/** Value for <input type="date"> (YYYY-MM-DD), or "". */
export function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = parse(value);
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
