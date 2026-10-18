/**
 * checkConnection.js
 *
 * Verifies the Supabase connection by calling a lightweight RPC.
 * Falls back to a simple HTTP ping if the schema is not applied yet.
 *
 * Usage (run once on app start, e.g. in main.jsx):
 *   import { checkSupabaseConnection } from "./lib/checkConnection.js";
 *   checkSupabaseConnection().then(console.log);
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   status: "not_configured" | "connected" | "schema_missing" | "unreachable",
 *   message: string,
 *   latencyMs?: number
 * }>}
 */
export async function checkSupabaseConnection() {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      status: "not_configured",
      message: "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from .env",
    };
  }

  const start = Date.now();

  try {
    // Ping the settings table (exists after schema is applied)
    const { error } = await supabase
      .from("settings")
      .select("key")
      .limit(1);

    const latencyMs = Date.now() - start;

    if (!error) {
      return {
        ok: true,
        status: "connected",
        message: `Connected to Supabase (${latencyMs} ms)`,
        latencyMs,
      };
    }

    // Table missing = schema not applied yet, but the connection works
    if (
      error.code === "PGRST116" ||
      error.message?.includes("does not exist") ||
      error.message?.includes("schema cache")
    ) {
      return {
        ok: false,
        status: "schema_missing",
        message:
          "Supabase is reachable but the schema is not applied yet. " +
          "Run server/config/wollo-exam-prep-supabase (1).sql in the Supabase SQL editor.",
        latencyMs,
      };
    }

    return {
      ok: false,
      status: "unreachable",
      message: `Supabase error: ${error.message}`,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      status: "unreachable",
      message: `Network error: ${err.message}`,
    };
  }
}
