// Safe to import anywhere (no secrets are read here besides checking presence on the server).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export const NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Copy .env.example to .env.local and add your Supabase credentials.";
