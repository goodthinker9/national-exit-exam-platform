/**
 * server/index.js
 * Entry point — starts Express and verifies the Supabase DB connection.
 *
 * Run from the server/ folder:
 *   node index.js        (production)
 *   node --watch index.js  (dev, auto-restart on file changes)
 */

// ── 1. Load .env from project root ────────────────────────────────────────────
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const require    = createRequire(import.meta.url);

// Use require() for dotenv so it runs synchronously before any async code
const dotenv = require("dotenv");
dotenv.config({ path: resolve(__dirname, "../.env") });

// ── 2. Validate env vars ──────────────────────────────────────────────────────
const REQUIRED = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
];
const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`\n  Missing env vars: ${missing.join(", ")}`);
  console.error(`    Ensure .env exists in the project root.\n`);
  process.exit(1);
}

// ── 3. Create Supabase admin client (inline — avoids ES module load-order issues)
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,         // service role — bypasses RLS
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── 4. Express setup ──────────────────────────────────────────────────────────
import express from "express";
import cors    from "cors";

const PORT          = process.env.PORT          || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ── 5. Routes ─────────────────────────────────────────────────────────────────

/** Basic health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Live DB connectivity check */
app.get("/health/db", async (_req, res) => {
  const result = await checkDB();
  res.status(result.ok ? 200 : 503).json(result);
});

// ── 6. Start listening ────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log("\n──────────────────────────────────────────────────");
  console.log(`    Wollo Exam Prep — API server`);
  console.log(`    Listening on   http://localhost:${PORT}`);
  console.log(`    Client origin  ${CLIENT_ORIGIN}`);
  console.log("──────────────────────────────────────────────────");
  await testDBConnection();
});

// ── 7. DB connection helpers ──────────────────────────────────────────────────

async function checkDB() {
  const start = Date.now();
  try {
    // `settings` is a lightweight table seeded with 2 rows in the SQL script.
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, value")
      .limit(10);

    const ms = Date.now() - start;

    if (error) {
      const schemaMissing =
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache") ||
        error.code === "42P01";

      return {
        ok:        false,
        status:    schemaMissing ? "schema_missing" : "error",
        message:   schemaMissing
          ? "Supabase is reachable but the schema is not applied yet."
          : error.message,
        hint: schemaMissing
          ? "Run server/config/wollo-exam-prep-supabase (1).sql in the Supabase SQL editor."
          : null,
        latencyMs: ms,
      };
    }

    return {
      ok:        true,
      status:    "connected",
      message:   `Connected to Supabase (${ms} ms)`,
      latencyMs: ms,
      settings:  data,
    };
  } catch (err) {
    return {
      ok:      false,
      status:  "unreachable",
      message: `Network error: ${err.message}`,
    };
  }
}

async function testDBConnection() {
  console.log("\n  Checking Supabase DB connection …");
  const result = await checkDB();

  if (result.ok) {
    console.log(`\n  ✅  ${result.message}`);
    if (result.settings?.length) {
      console.log(`  📋  Platform settings:`);
      result.settings.forEach(({ key, value }) =>
        console.log(`        ${key.padEnd(16)} = ${value}`),
      );
    }
  } else if (result.status === "schema_missing") {
    console.warn(`\n  ⚠️   Supabase is reachable — but the schema is not applied yet.`);
    console.warn(`  👉  Steps to fix:`);
    console.warn(`      1. Open  https://app.supabase.com`);
    console.warn(`      2. Go to SQL Editor`);
    console.warn(`      3. Paste and run:`);
    console.warn(`         server/config/wollo-exam-prep-supabase (1).sql`);
    console.warn(`      4. Restart this server`);
  } else {
    console.error(`\n  ❌  DB check failed: ${result.message}`);
    console.error(`  👉  Verify VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env`);
  }

  console.log("\n──────────────────────────────────────────────────\n");
}
