import { runHealthChecks } from "@/lib/health";

/** Checks the 50 least-recently-checked active links. Schedule every 15-60 minutes. */
export async function healthJob(limit = 50): Promise<Record<string, unknown>> {
  const r = await runHealthChecks(limit);
  return { ...r, limit };
}
