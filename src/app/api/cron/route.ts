import { NextRequest, NextResponse } from "next/server";
import { CRON_JOB_NAMES, cronAuthorized, runCronJob } from "@/lib/cron-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET|POST /api/cron — runs every cron job in sequence (same auth as /api/cron/:job). `?only=a,b` limits the run. */
async function handle(req: NextRequest) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: 1, message: auth.reason }, { status: auth.reason.includes("configured") ? 503 : 401 });
  const only = (req.nextUrl.searchParams.get("only") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const jobs = only.length ? CRON_JOB_NAMES.filter((j) => only.includes(j)) : CRON_JOB_NAMES;
  const results = [];
  for (const job of jobs) results.push(await runCronJob(job));
  const failed = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ error: failed ? 1 : 0, ran: results.length, failed, results });
}

export const GET = handle;
export const POST = handle;
