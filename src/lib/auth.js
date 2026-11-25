import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/errors";
import { getPasscode } from "@/lib/passcode";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Guard for route handlers: requires a valid admin session cookie, then returns a Supabase
 * client that carries the passcode header so the database accepts its queries.
 */
export async function requireAdmin() {
  const passcode = getPasscode();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!(await verifySessionToken(token, passcode))) throw new ApiError(401, "Unauthorized access");
  return { supabase: createClient(passcode) };
}
