import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/errors";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
  NOT_CONFIGURED_MESSAGE,
} from "./env";

/**
 * Supabase client for server code. It uses only the public anon key and sends the admin
 * passcode in the `x-admin-key` header; the database policies accept a request only when
 * that header matches the stored passcode hash (see supabase/migrations/0001_init.sql).
 * No Supabase Auth session is involved.
 */
export function createClient(adminPasscode) {
  if (!isSupabaseConfigured()) throw new ApiError(503, NOT_CONFIGURED_MESSAGE);

  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-admin-key": adminPasscode } },
  });
}
