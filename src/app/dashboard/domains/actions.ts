"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { isValidHostname, normalizeHostname, appHostname, verifyDomain } from "@/lib/domain-verify";
import { randomToken } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/ui/form-state";
import { str, isHttpUrl } from "@/lib/forms";
import { cloudflareConfig, provisionHostname, removeHostname } from "@/lib/cloudflare";

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "domains", action)) return { error: "You do not have permission to manage domains" as const };
  const s = await getSettings();
  if (s["domains.custom"] !== "1") return { error: "Custom domains are disabled" as const };
  const { plan, user } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && (plan?.limitDomains ?? 0) === 0) return { error: "Custom domains are not available on your plan. Please upgrade." as const };
  return { ws, s };
}

function parseRedirects(fd: FormData) {
  const rootRedirect = str(fd, "rootRedirect", 500);
  const notFoundRedirect = str(fd, "notFoundRedirect", 500);
  if (rootRedirect && !isHttpUrl(rootRedirect)) return { error: "Root redirect must be a valid http(s) URL" };
  if (notFoundRedirect && !isHttpUrl(notFoundRedirect)) return { error: "404 redirect must be a valid http(s) URL" };
  return { data: { rootRedirect: rootRedirect || null, notFoundRedirect: notFoundRedirect || null } };
}

export async function addDomain(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const limit = await withinLimit(g.ws.ownerId, "limitDomains");
  if (!limit.ok) return { error: `You have reached your plan limit of ${limit.limit} custom domains. Please upgrade.` };
  const domain = normalizeHostname(str(fd, "domain", 253));
  if (!domain || !isValidHostname(domain)) return { error: "Please enter a valid domain name, e.g. links.example.com" };
  if (domain === appHostname().toLowerCase()) return { error: "This is the main domain of the service" };
  const exists = await db.domain.findUnique({ where: { domain } });
  if (exists) return { error: "This domain is already registered" };
  const r = parseRedirects(fd);
  if ("error" in r) return { error: r.error };
  // domains.verifyDns=0 → activate immediately; otherwise pending until verification succeeds.
  let status = g.s["domains.verifyDns"] === "1" ? 0 : 1;
  let message = status === 1 ? "Domain added. Point its DNS to this server to start using it." : "Domain added. Configure DNS then click Verify.";
  if (status === 0) {
    const v = await verifyDomain(domain);
    if (v.ok) { status = 1; message = `Domain added and verified (${v.message}).`; }
  }
  const created = await db.domain.create({ data: { domain, userId: g.ws.ownerId, status, verifyToken: randomToken(16), ...r.data } });
  if ((await cloudflareConfig()).enabled) {
    const cf = await provisionHostname(created);
    message += cf.ok ? ` SSL: ${cf.message}` : ` SSL provisioning failed: ${cf.message}`;
  }
  revalidatePath("/dashboard/domains");
  return { ok: true, message };
}

export async function updateDomain(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.domain.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Domain not found" };
  const r = parseRedirects(fd);
  if ("error" in r) return { error: r.error };
  await db.domain.update({ where: { id }, data: r.data });
  revalidatePath("/dashboard/domains");
  return { ok: true, message: "Domain updated" };
}

/** Server-action fallback for verification (the Verify button uses /api/domains/verify). */
export async function verifyDomainAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.domain.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Domain not found" };
  const v = await verifyDomain(existing.domain);
  if (!v.ok) return { error: v.message };
  await db.domain.update({ where: { id }, data: { status: 1 } });
  if ((await cloudflareConfig()).enabled) await provisionHostname(existing);
  revalidatePath("/dashboard/domains");
  return { ok: true, message: v.message };
}

/** Re-reads the Cloudflare custom hostname / certificate status (provisions it when missing). */
export async function refreshSslAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.domain.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Domain not found" };
  if (!(await cloudflareConfig()).enabled) return { error: "Automatic SSL is not enabled" };
  const r = await provisionHostname(existing);
  revalidatePath("/dashboard/domains");
  return r.ok ? { ok: true, message: r.message } : { error: r.message };
}

export async function deleteDomain(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.domain.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  // Links/bio pages on this domain are moved to the main domain (domainId → null) and stop resolving on the custom host.
  await removeHostname(existing);
  await db.domain.delete({ where: { id } });
  revalidatePath("/dashboard/domains");
  revalidatePath("/dashboard/links");
}
