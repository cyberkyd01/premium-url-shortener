import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import pkg from "../../../package.json";

export async function dirSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0, files = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const s = await dirSize(p); bytes += s.bytes; files += s.files; }
      else { const st = await fs.stat(p); bytes += st.size; files++; }
    }
  } catch { /* missing dir */ }
  return { bytes, files };
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function dbProvider() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("mysql")) return "mysql";
  if (url.startsWith("postgres")) return "postgresql";
  return "unknown";
}

export async function dbSize(): Promise<number | null> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return null;
  const rel = url.replace(/^file:/, "");
  const candidates = [path.resolve(process.cwd(), "prisma", rel), path.resolve(process.cwd(), rel)];
  for (const c of candidates) {
    try { return (await fs.stat(c)).size; } catch { /* next */ }
  }
  return null;
}

export const APP_VERSION: string = (pkg as { version?: string }).version ?? "1.0.0";

export async function systemInfo() {
  const uploads = await dirSize(path.join(process.cwd(), "public", "uploads"));
  return {
    version: APP_VERSION,
    node: process.version,
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    env: process.env.NODE_ENV ?? "development",
    db: dbProvider(),
    dbBytes: await dbSize(),
    uploads,
    memory: process.memoryUsage().rss,
    uptime: process.uptime(),
    cwd: process.cwd(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export const TABLE_NAMES = ["user", "link", "click", "bioPage", "qrCode", "campaign", "domain", "payment", "subscription", "plan", "coupon", "report", "page", "blogPost", "ticket", "hostedFile"] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export async function tableCounts(): Promise<Record<TableName, number>> {
  const out = {} as Record<TableName, number>;
  await Promise.all(TABLE_NAMES.map(async (t) => { out[t] = await (db[t] as unknown as { count: () => Promise<number> }).count(); }));
  return out;
}
