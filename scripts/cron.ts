/**
 * Cron runner: calls every /api/cron/<job> endpoint of the running app with CRON_SECRET.
 *
 *   pnpm cron                 run every job once
 *   pnpm cron --job backup    run a single job
 *   pnpm cron --loop 10       keep running every 10 minutes (Docker sidecar)
 *
 * Environment: APP_URL (or NEXTAUTH_URL), CRON_SECRET. Reads .env automatically when present.
 */
import "dotenv/config";

const JOBS = ["expire-plans", "expire-links", "cleanup", "subscriptions", "notify-expiring", "imports", "reset-ai-credits", "storage-sync", "backup"] as const;

const args = process.argv.slice(2);
const argValue = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET || "";
const only = argValue("--job");
const loopMinutes = Number(argValue("--loop") || process.env.CRON_INTERVAL_MINUTES || 0);

if (!secret || secret === "change-me") {
  console.error("[cron] CRON_SECRET is not set. Add it to .env and to the admin cron configuration.");
  process.exit(1);
}

interface CronResponse { error: number; job?: string; status?: string; ms?: number; summary?: Record<string, unknown>; message?: string }

async function runJob(job: string): Promise<boolean> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/cron/${job}`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "user-agent": "PremiumURLShortener-Cron/1.0" } });
    const body = (await res.json().catch(() => ({ error: 1, message: `HTTP ${res.status}` }))) as CronResponse;
    const ok = res.ok && body.error === 0;
    const detail = ok ? JSON.stringify(body.summary ?? {}) : body.message ?? `HTTP ${res.status}`;
    console.log(`[cron] ${ok ? "ok  " : "FAIL"} ${job.padEnd(18)} ${String(Date.now() - started).padStart(6)}ms ${detail}`);
    return ok;
  } catch (e) {
    console.log(`[cron] FAIL ${job.padEnd(18)} ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function runAll() {
  const list = only ? [only] : [...JOBS];
  console.log(`[cron] ${new Date().toISOString()} running ${list.length} job(s) against ${baseUrl}`);
  let failed = 0;
  for (const job of list) if (!(await runJob(job))) failed++;
  console.log(`[cron] done, ${list.length - failed} ok, ${failed} failed`);
  return failed;
}

async function main() {
  if (loopMinutes > 0) {
    console.log(`[cron] loop mode: every ${loopMinutes} minute(s)`);
    for (;;) {
      await runAll();
      await new Promise((r) => setTimeout(r, loopMinutes * 60_000));
    }
  }
  const failed = await runAll();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
