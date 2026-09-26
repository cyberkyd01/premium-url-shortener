import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getSettings } from "./settings";

/** File storage abstraction: local disk by default; S3-compatible (AWS S3, DigitalOcean Spaces, Cloudflare R2,
 *  Backblaze B2, Wasabi, Vultr, Contabo, custom) via a signed PUT when configured in admin settings. */
export async function storeFile(file: File, folder = "uploads"): Promise<{ url: string; path: string }> {
  const s = await getSettings();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const allowed = (s["storage.allowedExtensions"] || "").split(",").map((e) => e.trim());
  if (allowed.length && !allowed.includes(ext)) throw new Error("File type not allowed");
  const maxKb = parseInt(s["storage.maxSizeKb"] || "5120", 10);
  if (file.size > maxKb * 1024) throw new Error(`File exceeds ${maxKb} KB`);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (s["storage.driver"] !== "local" && s["storage.bucket"]) {
    const key = `${folder}/${name}`;
    await s3Put(s, key, buf, file.type);
    const cdn = s["storage.cdnUrl"] || `${s["storage.endpoint"]}/${s["storage.bucket"]}`;
    return { url: `${cdn.replace(/\/$/, "")}/${key}`, path: key };
  }
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${folder}/${name}`, path: `${folder}/${name}` };
}

/** Minimal AWS Signature V4 PUT for S3-compatible providers. */
async function s3Put(s: Record<string, string>, key: string, body: Buffer, contentType: string) {
  const endpoint = (s["storage.endpoint"] || `https://s3.${s["storage.region"] || "us-east-1"}.amazonaws.com`).replace(/\/$/, "");
  const url = new URL(`${endpoint}/${s["storage.bucket"]}/${key}`);
  const region = s["storage.region"] || "us-east-1";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, "content-type": contentType || "application/octet-stream", "x-amz-acl": "public-read" };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join("");
  const canonical = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonical).digest("hex")].join("\n");
  const hmac = (k: Buffer | string, d: string) => crypto.createHmac("sha256", k).update(d).digest();
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + s["storage.secret"], date), region), "s3"), "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(toSign).digest("hex");
  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${s["storage.key"]}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });
  if (!res.ok) throw new Error("Upload failed: " + res.status);
}
