"use server";
import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { createLink } from "@/lib/links";
import { clientIp } from "@/lib/geo";
import type { ActionState } from "@/components/ui/form-state";

const MAX_ROWS = 500;
const BATCH = 25;

interface Row { url?: string; alias?: string; title?: string; domain?: string; channel?: string; description?: string }

/** Imports up to 500 links from a CSV (columns: url, alias, title, domain, channel). Processed in batches within the request. */
export async function importCsv(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "create")) return { error: "You do not have permission to create links" };
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.import) return { error: "Import is not available on your plan" };
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Please choose a CSV file" };
  if (file.size > 2 * 1024 * 1024) return { error: "File is too large (max 2 MB)" };
  let rows: Row[];
  try {
    rows = parse(Buffer.from(await file.arrayBuffer()).toString("utf8"), { columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()), skip_empty_lines: true, trim: true, relax_column_count: true, bom: true }) as Row[];
  } catch (e) { return { error: "Could not parse CSV: " + (e instanceof Error ? e.message : "invalid file") }; }
  if (!rows.length) return { error: "The file has no rows" };
  if (!("url" in rows[0])) return { error: "The CSV needs a `url` column header" };
  const truncated = rows.length > MAX_ROWS;
  rows = rows.slice(0, MAX_ROWS);

  const [domains, channels] = await Promise.all([
    db.domain.findMany({ where: { status: 1, OR: [{ userId: ws.ownerId }, { isPublic: true }] } }),
    db.channel.findMany({ where: { userId: ws.ownerId } }),
  ]);
  const job = await db.importJob.create({ data: { userId: ws.ownerId, filename: file.name.slice(0, 120), total: rows.length, status: "processing" } });
  const errors: { row: number; error: string }[] = [];
  let processed = 0;
  const ip = clientIp(await headers());
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const n = i + j + 2; // 1-based + header
      try {
        const url = (r.url ?? "").trim();
        if (!url) throw new Error("Missing url");
        const domainName = (r.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        const domain = domainName ? domains.find((d) => d.domain.toLowerCase() === domainName) : null;
        if (domainName && !domain) throw new Error(`Unknown domain ${domainName}`);
        const channelName = (r.channel ?? "").trim().toLowerCase();
        const channel = channelName ? channels.find((c) => c.name.toLowerCase() === channelName) : null;
        const link = await createLink(ws.ownerId, { url, alias: (r.alias ?? "").trim() || null, domainId: domain?.id ?? null, title: (r.title ?? "").trim() || null, description: (r.description ?? "").trim() || null, teamId: ws.teamId }, { ip });
        if (channel) await db.link.update({ where: { id: link.id }, data: { channelId: channel.id } });
        processed++;
      } catch (e) {
        errors.push({ row: n, error: e instanceof Error ? e.message : "Failed" });
      }
    }
    await db.importJob.update({ where: { id: job.id }, data: { processed, failed: errors.length } });
  }
  await db.importJob.update({ where: { id: job.id }, data: { processed, failed: errors.length, status: "done", errors: JSON.stringify(errors.slice(0, 200)) } });
  revalidatePath("/dashboard/import"); revalidatePath("/dashboard/links");
  return { ok: true, message: `Imported ${processed} of ${rows.length} links${errors.length ? `, ${errors.length} failed` : ""}${truncated ? ` (only the first ${MAX_ROWS} rows were processed)` : ""}.`, data: { processed, failed: errors.length, errors: errors.slice(0, 50) } };
}
