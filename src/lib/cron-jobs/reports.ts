import { db } from "@/lib/db";
import { digestDue, sendDigest } from "@/lib/reports";

/** Sends weekly (Mondays) and monthly (1st) email digests to users who opted in. Schedule daily. */
export async function reportsJob(now = new Date()): Promise<Record<string, unknown>> {
  const users = await db.user.findMany({ where: { reportFrequency: { in: ["weekly", "monthly"] }, status: 1 }, select: { id: true, reportFrequency: true, reportSentAt: true } });
  let sent = 0, skipped = 0, failed = 0;
  for (const u of users) {
    if (!digestDue(u.reportFrequency, u.reportSentAt, now)) { skipped++; continue; }
    try {
      const ok = await sendDigest(u.id, u.reportFrequency === "monthly" ? "monthly" : "weekly");
      if (ok) sent++; else failed++;
    } catch (e) { failed++; console.error("[reports] digest failed", u.id, e); }
  }
  return { candidates: users.length, sent, skipped, failed, weekday: now.getDay(), dayOfMonth: now.getDate() };
}
