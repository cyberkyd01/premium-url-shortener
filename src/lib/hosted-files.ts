/** File hosting helpers: at-rest AES-256-GCM encryption for locally stored files, storage accounting. */
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { db } from "./db";
import { getSettings } from "./settings";

const MAGIC = Buffer.from("PUSENC1");

/** Encryption key: derived from the file password when set, otherwise from CRON_SECRET/AUTH_SECRET. */
export function fileKey(password?: string | null, salt?: Buffer) {
  const secret = password && password.length > 0 ? password : process.env.CRON_SECRET || process.env.AUTH_SECRET || "insecure-default-key";
  const s = salt ?? crypto.randomBytes(16);
  return { key: crypto.scryptSync(secret, s, 32), salt: s };
}

export function encryptBuffer(buf: Buffer, password?: string | null) {
  const { key, salt } = fileKey(password);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), enc]);
}

export function decryptBuffer(buf: Buffer, password?: string | null) {
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) return buf;
  let o = MAGIC.length;
  const salt = buf.subarray(o, o + 16); o += 16;
  const iv = buf.subarray(o, o + 12); o += 12;
  const tag = buf.subarray(o, o + 16); o += 16;
  const { key } = fileKey(password, salt);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(o)), d.final()]);
}

export function localPath(rel: string) {
  return path.join(process.cwd(), "public", "uploads", rel);
}

export async function isLocalStorage() {
  const s = await getSettings();
  return s["storage.driver"] === "local" || !s["storage.bucket"];
}

/** Stores a hosted file (optionally encrypted) under public/uploads/files or the S3-compatible bucket. Returns relative path + public URL. */
export async function saveHostedFile(file: File, opts: { encrypt: boolean; password?: string | null }) {
  const s = await getSettings();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const allowed = (s["storage.allowedExtensions"] || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(ext)) throw new Error("File type not allowed");
  const maxKb = parseInt(s["storage.maxSizeKb"] || "5120", 10);
  if (file.size > maxKb * 1024) throw new Error(`File exceeds ${maxKb} KB`);
  const local = await isLocalStorage();
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  let buf = Buffer.from(await file.arrayBuffer());
  const encrypted = opts.encrypt && local;
  if (encrypted) buf = encryptBuffer(buf, opts.password);
  if (local) {
    const dir = localPath("files");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buf);
    return { path: `files/${name}`, url: `/uploads/files/${name}`, encrypted, local: true };
  }
  // Remote storage: reuse storeFile via a synthetic File (never encrypted)
  const { storeFile } = await import("./storage");
  const stored = await storeFile(new File([new Uint8Array(buf)], file.name, { type: file.type }), "files");
  return { path: stored.path, url: stored.url, encrypted: false, local: false };
}

export async function deleteHostedFile(rel: string, isLocal: boolean) {
  if (!isLocal) return; // remote objects are left in the bucket (no delete API in storage lib)
  await fs.unlink(localPath(rel)).catch(() => {});
}

export async function recalcStorage(userId: string) {
  const agg = await db.hostedFile.aggregate({ where: { userId }, _sum: { size: true } });
  await db.user.update({ where: { id: userId }, data: { storageUsed: agg._sum.size ?? 0 } });
  return agg._sum.size ?? 0;
}
