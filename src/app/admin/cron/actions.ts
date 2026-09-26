"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str } from "@/lib/admin/query";
import { appUrl } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

/** Runs a cron job now: in-process via the cron-jobs library, falling back to an HTTP call with the secret. */
export async function runCronNow(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const job = str(fd, "job").replace(/[^a-z-]/g, "");
    if (!job) return { ok: false, error: "Unknown job." };
    try {
      const mod = await import("@/lib/cron-runner");
      const r = await mod.runCronJob(job);
      revalidatePath("/admin/cron");
      return r.status === "ok" ? { ok: true, message: `${job} finished in ${r.ms} ms: ${JSON.stringify(r.summary ?? {})}` } : { ok: false, error: `${job} failed: ${r.message}` };
    } catch {
      const secret = process.env.CRON_SECRET;
      if (!secret) return { ok: false, error: "CRON_SECRET is not configured." };
      const res = await fetch(appUrl(`/api/cron/${job}`), { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" });
      const text = (await res.text()).slice(0, 500);
      revalidatePath("/admin/cron");
      return res.ok ? { ok: true, message: `HTTP ${res.status}: ${text}` } : { ok: false, error: `HTTP ${res.status}: ${text}` };
    }
  });
}

export async function clearCronLogs(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const r = await db.cronLog.deleteMany({});
    revalidatePath("/admin/cron");
    return { ok: true, message: `Deleted ${r.count} log rows.` };
  });
}
