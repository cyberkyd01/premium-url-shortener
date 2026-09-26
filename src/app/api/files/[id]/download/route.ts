import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { decryptBuffer, isLocalStorage, localPath } from "@/lib/hosted-files";
import { sha256 } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams a hosted file. Password is verified from `?pw=` or the `file_pw_{id}` cookie (plain password or sha256 of the stored hash, as set by the download page). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const file = await db.hostedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: true, message: "File not found" }, { status: 404 });
  if (file.expiresAt && file.expiresAt < new Date()) return NextResponse.json({ error: true, message: "This file has expired" }, { status: 410 });
  const me = await currentUser();
  const isOwner = me && (me.id === file.userId || me.role === "admin");
  if (file.password && !isOwner) {
    const pw = req.nextUrl.searchParams.get("pw") ?? req.cookies.get(`file_pw_${file.id}`)?.value ?? "";
    let ok = false;
    if (pw) ok = pw === sha256(file.password) || (await bcrypt.compare(pw, file.password).catch(() => false));
    if (!ok) return NextResponse.json({ error: true, message: "Password required" }, { status: 401 });
  }
  const local = await isLocalStorage();
  let buf: Buffer;
  if (local) {
    try { buf = await fs.readFile(localPath(file.path)); } catch { return NextResponse.json({ error: true, message: "File missing on disk" }, { status: 404 }); }
    if (file.encrypted) { try { buf = decryptBuffer(buf, null); } catch { return NextResponse.json({ error: true, message: "Could not decrypt file" }, { status: 500 }); } }
  } else {
    // Remote storage: redirect to the public object URL (never encrypted)
    const s = await (await import("@/lib/settings")).getSettings();
    const cdn = s["storage.cdnUrl"] || `${s["storage.endpoint"]}/${s["storage.bucket"]}`;
    await db.hostedFile.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } });
    return NextResponse.redirect(`${cdn.replace(/\/$/, "")}/${file.path}`);
  }
  if (!isOwner) await db.hostedFile.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } });
  const safeName = file.name.replace(/[^\w.\- ()]/g, "_");
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": file.mime || "application/octet-stream", "content-length": String(buf.length), "content-disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
