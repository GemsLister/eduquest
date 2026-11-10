import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT, "data");
export const DATA_FILE = path.join(DATA_DIR, "users.json");

// Test accounts all use this pattern, so reset can find them and real
// accounts can never match.
export const STUDENT_EMAIL = (n) => `s${String(n).padStart(4, "0")}.loadtest@example.com`;
export const INSTRUCTOR_EMAIL = (n) => `i${String(n).padStart(3, "0")}.loadtest@example.com`;
export const TEST_EMAIL_LIKE = "%.loadtest@example.com";
export const ROUND_TITLE = "[k6] Exam day round";
export const RESULTS_TITLE = "[k6] Results page exam";
export const INSTRUCTOR_EXAM_TITLE = "[k6 instructor]";

// The production project. Read from the CLI link file too, in case it changes.
function productionRefs() {
  const refs = new Set(["ycebpvxbvlztyoysjwvx"]);
  try {
    const linked = fs.readFileSync(path.join(ROOT, "..", "supabase", ".temp", "project-ref"), "utf8").trim();
    if (linked) refs.add(linked);
  } catch {
    // no linked project file
  }
  return refs;
}

export function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a whole number, got "${raw}"`);
  return n;
}

export function loadConfig({ needServiceKey = true } = {}) {
  const url = (process.env.TEST_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "";

  const missing = [];
  if (!url || url.includes("your-test-project-ref")) missing.push("TEST_SUPABASE_URL");
  if (!anonKey) missing.push("TEST_SUPABASE_ANON_KEY");
  if (needServiceKey && !serviceKey) missing.push("TEST_SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    throw new Error(`Fill in ${missing.join(", ")} in stress-test/.env (copy .env.example first).`);
  }

  let ref;
  try {
    ref = new URL(url).hostname.split(".")[0];
  } catch {
    throw new Error(`TEST_SUPABASE_URL is not a valid URL: ${url}`);
  }
  if (productionRefs().has(ref)) {
    throw new Error(
      `TEST_SUPABASE_URL points at the PRODUCTION project (${ref}). ` +
        "Create a separate Supabase project for load testing and use its URL and keys.",
    );
  }
  return { url, anonKey, serviceKey, ref };
}

export function adminClient(cfg) {
  return createClient(cfg.url, cfg.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run fn over items with at most `concurrency` running at once. */
export async function pool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function readData(cfg) {
  if (!fs.existsSync(DATA_FILE)) return null;
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (cfg && data.project?.url !== cfg.url) {
    throw new Error(
      `data/users.json belongs to ${data.project?.url}, but .env points at ${cfg.url}. ` +
        "Delete stress-test/data/users.json to seed a different project.",
    );
  }
  return data;
}

export function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/** Throw a readable error for a supabase-js { error } result. */
export function must(result, what) {
  if (result.error) {
    const e = result.error;
    throw new Error(`${what} failed: ${e.message}${e.details ? ` (${e.details})` : ""}${e.hint ? ` Hint: ${e.hint}` : ""}`);
  }
  return result.data;
}

export function progress(label, done, total) {
  process.stdout.write(`\r  ${label}: ${done}/${total}   `);
  if (done === total) process.stdout.write("\n");
}
