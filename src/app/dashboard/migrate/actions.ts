"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { clientIp } from "@/lib/geo";
import { fetchBitlyLinks, fetchRebrandlyLinks, parseCsvExport, runMigration, isMigrationError, MAX_BATCH, type ImportRow, type MigrationSource } from "@/lib/migrate";
import type { ActionState } from "@/components/ui/form-state";

async function guard() {
  const ws = await getWorkspace();
  if (!ws) throw new Error("Please login");
  if (!can(ws, "links", "create")) throw new Error("You do not have permission to create links in this team");
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.import) throw new Error("Importing links is not included in your plan. Please upgrade.");
  return ws;
}

async function domainFor(ownerId: string, raw: string) {
  if (!raw) return null;
  const d = await db.domain.findFirst({ where: { id: raw, status: 1, OR: [{ userId: ownerId }, { isPublic: true }] } });
  if (!d) throw new Error("Invalid domain");
  return d.id;
}

function fail(e: unknown): ActionState { return { error: e instanceof Error ? e.message : "Something went wrong" }; }

async function run(source: MigrationSource, rows: ImportRow[], fd: FormData): Promise<ActionState> {
  const ws = await guard();
  if (!rows.length) return { error: "No links found to import" };
  const domainId = await domainFor(ws.ownerId, String(fd.get("domainId") ?? ""));
  const result = await runMigration(ws.ownerId, source, rows, { teamId: ws.teamId, domainId, keepAliases: fd.get("keepAliases") !== "0", tag: String(fd.get("tag") ?? "") || null, ip: clientIp(await headers()) });
  revalidatePath("/dashboard/migrate"); revalidatePath("/dashboard/links");
  const truncated = rows.length > MAX_BATCH ? ` (first ${MAX_BATCH} of ${rows.length} processed; run again for the rest)` : "";
  return { ok: true, message: `${result.imported} imported, ${result.skipped} skipped${truncated}`, data: { jobId: result.jobId, log: result.log.slice(0, 200) } };
}

/** Bitly: token → groups → bitlinks (+ historic clicks). */
export async function migrateBitly(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const token = String(fd.get("token") ?? "").trim();
    if (!token) return { error: "Please paste your Bitly access token" };
    const rows = await fetchBitlyLinks(token, MAX_BATCH);
    return await run("bitly", rows, fd);
  } catch (e) { return isMigrationError(e) ? { error: e.message } : fail(e); }
}

/** Rebrandly: API key → links. */
export async function migrateRebrandly(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const key = String(fd.get("apiKey") ?? "").trim();
    if (!key) return { error: "Please paste your Rebrandly API key" };
    const rows = await fetchRebrandlyLinks(key, MAX_BATCH);
    return await run("rebrandly", rows, fd);
  } catch (e) { return isMigrationError(e) ? { error: e.message } : fail(e); }
}

/** CSV export from Bitly / TinyURL / Rebrandly / Short.io (columns auto-detected). */
export async function migrateCsv(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Please choose a CSV file" };
    if (file.size > 5 * 1024 * 1024) return { error: "The file is too large (max 5 MB)" };
    const parsed = parseCsvExport(await file.text(), MAX_BATCH + 1);
    if (!parsed.rows.length) return { error: `No destination URLs detected. Detected columns: ${JSON.stringify(parsed.mapping)}` };
    const r = await run("csv", parsed.rows, fd);
    if (r?.ok) r.message = `${r.message}. Columns: ${Object.entries(parsed.mapping).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ")}`;
    return r;
  } catch (e) { return fail(e); }
}

/** Preview a CSV without importing: returns detected mapping + first rows. */
export async function previewCsv(fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Please choose a CSV file" };
    const parsed = parseCsvExport(await file.text(), 20);
    return { ok: true, data: { mapping: parsed.mapping, rows: parsed.rows.slice(0, 5) } };
  } catch (e) { return fail(e); }
}
