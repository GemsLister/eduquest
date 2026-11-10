// Signs every test account in and stores its login tokens in data/users.json,
// so k6 never has to log in during a test (Supabase limits sign-ins per IP,
// and 1,000 logins from one laptop would only measure that limit).
//
// Only accounts whose token is missing or expires within MIN_VALID_MINUTES are
// signed in again, so re-running this before each test is quick.
//
//   npm run tokens            refresh tokens that are missing or expiring
//   npm run tokens -- --all   sign everyone in again

import { pathToFileURL } from "node:url";
import { loadConfig, readData, writeData, pool, sleep, intEnv, progress } from "./common.mjs";

const MIN_VALID_MINUTES = 90;

async function signIn(cfg, email, password) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return res.json();

    const body = await res.text();
    if (res.status === 429 && attempt <= 20) {
      process.stdout.write(`\n  Sign-in rate limit hit, waiting 60s (raise it under Authentication -> Rate Limits in the TEST project to go faster)\n`);
      await sleep(60_000);
      continue;
    }
    if (res.status >= 500 && attempt <= 3) {
      await sleep(2_000 * attempt);
      continue;
    }
    throw new Error(`Sign-in failed for ${email}: HTTP ${res.status} ${body}`);
  }
}

export async function collectTokens(cfg, data, { all = false } = {}) {
  const concurrency = intEnv("TOKEN_CONCURRENCY", 3);
  const cutoff = Math.floor(Date.now() / 1000) + MIN_VALID_MINUTES * 60;
  const accounts = [...data.instructors, ...data.students];
  const todo = accounts.filter((a) => all || !a.access_token || !a.expires_at || a.expires_at < cutoff);

  if (todo.length === 0) {
    console.log(`All ${accounts.length} tokens are valid for at least ${MIN_VALID_MINUTES} more minutes.`);
    return;
  }
  console.log(`Signing in ${todo.length} of ${accounts.length} accounts (${concurrency} at a time)...`);

  let done = 0;
  await pool(todo, concurrency, async (account) => {
    const session = await signIn(cfg, account.email, data.password);
    account.access_token = session.access_token;
    account.refresh_token = session.refresh_token;
    account.expires_at = session.expires_at;
    done++;
    progress("signed in", done, todo.length);
    if (done % 50 === 0) writeData(data); // keep progress if interrupted
  });
  writeData(data);

  const lifetimeMin = Math.round((todo[0].expires_at - Date.now() / 1000) / 60);
  console.log(`Tokens saved. They expire in about ${lifetimeMin} minutes.`);
  if (lifetimeMin < 150) {
    console.log(
      "  Tip: the soak test runs 2 hours. In the TEST project raise the access token\n" +
        "  (JWT) expiry to 14400 seconds so tokens outlive the longest test.",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cfg = loadConfig({ needServiceKey: false });
    const data = readData(cfg);
    if (!data) throw new Error("No data/users.json yet. Run `npm run seed` first.");
    await collectTokens(cfg, data, { all: process.argv.includes("--all") });
  } catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
  }
}
