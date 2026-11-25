import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/errors";

const MIN_LENGTH = 6;

/** The admin passcode from the server environment (never exposed to the browser). */
export function getPasscode() {
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode || passcode.length < MIN_LENGTH) {
    throw new ApiError(
      503,
      `Admin login is not configured. Set ADMIN_PASSCODE (at least ${MIN_LENGTH} characters) in .env.local and restart the server.`
    );
  }
  return passcode;
}

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// --- tiny in-memory brute-force limiter: 5 wrong codes per IP per 15 minutes ---
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

export function assertNotLocked(key) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILS) {
    throw new ApiError(429, "Too many failed attempts. Please try again in a few minutes.");
  }
}

export function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function clearFailures(key) {
  attempts.delete(key);
}
