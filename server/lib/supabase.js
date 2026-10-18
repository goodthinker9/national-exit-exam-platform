/**
 * server/lib/supabase.js
 * Server-side Supabase clients.
 * Loaded AFTER dotenv has run in index.js.
 */

import { createClient } from "@supabase/supabase-js";

const url            = process.env.VITE_SUPABASE_URL?.trim();
const anonKey        = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const secretKey      = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !anonKey || !secretKey) {
  console.error("❌  Missing Supabase env vars. Check your .env file.");
  process.exit(1);
}

/** Anon client — respects Row Level Security. */
export const supabaseAnon = createClient(url, anonKey, {
  auth: { persistSession: false },
});

/** Admin client — bypasses Row Level Security. Server-side only. */
export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
