"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { saveHostedFile, deleteHostedFile, recalcStorage, isLocalStorage } from "@/lib/hosted-files";
import { isValidAlias, randomAlias, isValidUrl } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/files";

async function aliasFree(alias: string, excludeId?: string) {
  const s = await getSettings();
  const reserved = (s["links.reservedAliases"] || "").split(",").map((x) => x.trim().toLowerCase());
  if (reserved.includes(alias.toLowerCase())) return false;
  const [f, l, b] = await Promise.all([
    db.hostedFile.findFirst({ where: { alias, ...(excludeId ? { NOT: { id: excludeId } } : {}) } }),
    db.link.findFirst({ where: { alias, domainId: null } }),
    db.bioPage.findFirst({ where: { alias, domainId: null } }),
  ]);
  return !f && !l && !b;
}

function branding(fd: FormData) {
  const logo = String(fd.get("brandLogo") ?? "").trim();
  return { title: String(fd.get("brandTitle") ?? "").trim().slice(0, 120), description: String(fd.get("brandDescription") ?? "").trim().slice(0, 500), logo: logo && (logo.startsWith("/") || isValidUrl(logo)) ? logo : "", color: /^#[0-9a-f]{6}$/i.test(String(fd.get("brandColor") ?? "")) ? String(fd.get("brandColor")) : "" };
}

async function checkDomain(userId: string, domainId: string) {
  if (!domainId) return null;
  const d = await db.domain.findFirst({ where: { id: domainId, status: 1, OR: [{ userId }, { isPublic: true }] } });
  return d ? d.id : null;
}

export async function uploadHostedFile(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const { user, plan } = await getUserPlan(u.id);
  const isAdmin = user.role === "admin";
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload" };
  if (!isAdmin) {
    const limitFiles = plan?.limitFiles ?? 0;
    if (limitFiles === 0) return { error: "Your plan does not include file hosting" };
    if (limitFiles !== -1 && (await db.hostedFile.count({ where: { userId: u.id } })) >= limitFiles) return { error: `You have reached your plan limit of ${limitFiles} files` };
    const limitMb = plan?.limitStorageMb ?? 0;
    if (limitMb !== -1 && user.storageUsed + file.size > limitMb * 1048576) return { error: `Not enough storage: your plan includes ${limitMb} MB` };
  }
  let alias = String(fd.get("alias") ?? "").trim();
  if (alias) { if (!isValidAlias(alias)) return { error: "Alias may only contain letters, numbers, - and _" }; if (!(await aliasFree(alias))) return { error: "This alias is already taken" }; }
  else { do { alias = randomAlias(7); } while (!(await aliasFree(alias))); }
  const password = String(fd.get("password") ?? "");
  const expires = String(fd.get("expiresAt") ?? "");
  const encrypt = fd.get("encrypted") === "1";
  const domainId = await checkDomain(u.id, String(fd.get("domainId") ?? ""));
  try {
    const stored = await saveHostedFile(file, { encrypt, password: null });
    await db.hostedFile.create({ data: { userId: u.id, alias, domainId, name: file.name.slice(0, 200), path: stored.path, size: file.size, mime: file.type || "application/octet-stream", password: password ? await bcrypt.hash(password, 10) : null, expiresAt: expires ? new Date(expires) : null, encrypted: stored.encrypted, branding: JSON.stringify(branding(fd)) } });
    await recalcStorage(u.id);
  } catch (e) { return { error: e instanceof Error ? e.message : "Upload failed" }; }
  revalidatePath(P);
  return { ok: true, message: `File uploaded: /${alias}` };
}

export async function updateHostedFile(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const f = await db.hostedFile.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!f) return { error: "File not found" };
  const alias = String(fd.get("alias") ?? "").trim() || f.alias;
  if (alias !== f.alias) { if (!isValidAlias(alias)) return { error: "Invalid alias" }; if (!(await aliasFree(alias, f.id))) return { error: "This alias is already taken" }; }
  const password = String(fd.get("password") ?? "");
  const removePassword = fd.get("removePassword") === "1";
  const expires = String(fd.get("expiresAt") ?? "");
  const domainId = await checkDomain(u.id, String(fd.get("domainId") ?? ""));
  await db.hostedFile.update({ where: { id: f.id }, data: { alias, name: String(fd.get("name") ?? "").trim().slice(0, 200) || f.name, domainId, password: removePassword ? null : password ? await bcrypt.hash(password, 10) : f.password, expiresAt: expires ? new Date(expires) : null, branding: JSON.stringify(branding(fd)) } });
  revalidatePath(P);
  return { ok: true, message: "File updated" };
}

export async function deleteHostedFileAction(fd: FormData) {
  const u = await requireUser();
  const f = await db.hostedFile.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!f) return;
  await deleteHostedFile(f.path, await isLocalStorage());
  await db.hostedFile.delete({ where: { id: f.id } });
  await recalcStorage(u.id);
  revalidatePath(P);
}
