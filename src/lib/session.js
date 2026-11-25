// Signed session cookie for the single admin login.
// Uses Web Crypto only, so it works in the Edge middleware and in Node route handlers.
// The HMAC key is the admin passcode: changing ADMIN_PASSCODE logs everyone out.

export const SESSION_COOKIE = "inv_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

const encoder = new TextEncoder();

async function sign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  return `${expires}.${await sign(secret, `inv-admin:${expires}`)}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret) return false;
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!signature || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return sameString(signature, await sign(secret, `inv-admin:${expires}`));
}
