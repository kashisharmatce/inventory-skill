// Validators ported from the original backend (src/validations/valid.js).

export const USER_STATUSES = ["inactive", "active", "pending", "returned"];

export const isValid = (value) => {
  if (typeof value === "undefined" || value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  return true;
};

export const isValidEmail = (input) =>
  /^[\w\.-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*\.[a-zA-Z]{2,}$/.test(input);

export const isValidMobile = (input) => /\+?\d{2}\s*\-?\d+/.test(input);

export const isValidStatus = (value) => USER_STATUSES.includes(value);

export const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** True when a form value was left empty ("" / null / undefined). */
export const isBlank = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");
