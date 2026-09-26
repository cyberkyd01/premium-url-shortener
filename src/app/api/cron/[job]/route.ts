import { NextRequest, NextResponse } from "next/server";
import { CRON_JOB_NAMES, cronAuthorized, runCronJob } from "@/lib/cron-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET|POST /api/cron/:job  — protected by `Authorization: Bearer $CRON_SECRET` or `?secret=`.
 * Jobs: expire-plans, expire-links, cleanup, subscriptions, notify-expiring, imports, reset-ai-credits, storage-sync, backup.
 */
async function handle(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: 1, message: auth.reason }, { status: auth.reason.includes("configured") ? 503 : 401 });
  const { job } = await params;
  if (!CRON_JOB_NAMES.includes(job)) return NextResponse.json({ error: 1, message: `Unknown job "${job}". Available: ${CRON_JOB_NAMES.join(", ")}` }, { status: 404 });
  const result = await runCronJob(job);
  return NextResponse.json({ error: result.status === "ok" ? 0 : 1, ...result }, { status: result.status === "ok" ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
