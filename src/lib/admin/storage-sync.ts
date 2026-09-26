import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getSettings } from "@/lib/settings";
import { dirSize } from "./system";

/** Uploads every file under public/uploads to the configured S3-compatible bucket, keeping the same key. */
export async function syncUploadsToStorage(): Promise<{ files: number; uploaded: number; skipped: string }> {
  const s = await getSettings();
  const root = path.join(process.cwd(), "public", "uploads");
  const { files } = await dirSize(root);
  if (s["storage.driver"] === "local" || !s["storage.bucket"]) return { files, uploaded: 0, skipped: "Storage driver is local or no bucket configured; nothing uploaded." };
  let uploaded = 0;
  async function walk(dir: string, prefix: string) {
    let entries: import("fs").Dirent[] = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, `${prefix}${e.name}/`);
      else { await s3Put(s, `${prefix}${e.name}`, await fs.readFile(p), mimeOf(e.name)); uploaded++; }
    }
  }
  await walk(root, "");
  return { files, uploaded, skipped: "" };
}

function mimeOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", mp3: "audio/mpeg", pdf: "application/pdf", csv: "text/csv", ico: "image/x-icon" };
  return map[ext] ?? "application/octet-stream";
}

async function s3Put(s: Record<string, string>, key: string, body: Buffer, contentType: string) {
  const endpoint = (s["storage.endpoint"] || `https://s3.${s["storage.region"] || "us-east-1"}.amazonaws.com`).replace(/\/$/, "");
  const url = new URL(`${endpoint}/${s["storage.bucket"]}/${key}`);
  const region = s["storage.region"] || "us-east-1";
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, "content-type": contentType, "x-amz-acl": "public-read" };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join("");
  const canonical = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonical).digest("hex")].join("\n");
  const hmac = (k: Buffer | string, d: string) => crypto.createHmac("sha256", k).update(d).digest();
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + s["storage.secret"], date), region), "s3"), "aws4_request");
  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${s["storage.key"]}/${scope}, SignedHeaders=${signedHeaders}, Signature=${crypto.createHmac("sha256", kSigning).update(toSign).digest("hex")}`;
  const res = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });
  if (!res.ok) throw new Error(`Upload of ${key} failed: ${res.status}`);
}
