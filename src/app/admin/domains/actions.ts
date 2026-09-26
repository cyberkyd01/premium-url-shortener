"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool } from "@/lib/admin/query";
import { setSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ui/form-state";

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

export async function addAdminDomains(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("domains.manage", async () => {
    const lines = str(fd, "domains", 20000).split(/\r?\n|,/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);
    if (!lines.length) return { ok: false, error: "Enter at least one domain." };
    const rootRedirect = optStr(fd, "rootRedirect"), notFoundRedirect = optStr(fd, "notFoundRedirect");
    let added = 0;
    for (const domain of lines) {
      if (!DOMAIN_RE.test(domain)) return { ok: false, error: `Invalid domain: ${domain}` };
      if (await db.domain.findUnique({ where: { domain } })) continue;
      await db.domain.create({ data: { domain, userId: null, isPublic: true, status: 1, rootRedirect, notFoundRedirect } });
      added++;
    }
    revalidatePath("/admin/domains");
    return { ok: true, message: `Added ${added} domain(s).` };
  });
}

export async function updateDomain(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("domains.manage", async () => {
    const id = str(fd, "id");
    await db.domain.update({ where: { id }, data: { rootRedirect: optStr(fd, "rootRedirect"), notFoundRedirect: optStr(fd, "notFoundRedirect"), isPublic: bool(fd, "isPublic"), status: bool(fd, "active") ? 1 : 0 } });
    revalidatePath("/admin/domains");
    return { ok: true, message: "Domain updated." };
  });
}

export async function domainQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("domains.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const domain = await db.domain.findUnique({ where: { id } });
    if (!domain) return { ok: false, error: "Domain not found." };
    if (op === "main") { await db.domain.updateMany({ data: { isMain: false } }); await db.domain.update({ where: { id }, data: { isMain: true, status: 1 } }); }
    else if (op === "approve") await db.domain.update({ where: { id }, data: { status: 1 } });
    else if (op === "delete") await db.domain.delete({ where: { id } });
    else if (op === "assign") {
      const login = str(fd, "user");
      if (!login) { await db.domain.update({ where: { id }, data: { userId: null, isPublic: true } }); }
      else {
        const user = await db.user.findFirst({ where: { OR: [{ username: login }, { email: login.toLowerCase() }] } });
        if (!user) return { ok: false, error: "User not found." };
        await db.domain.update({ where: { id }, data: { userId: user.id, isPublic: false } });
      }
    } else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/domains");
    return { ok: true, message: "Done." };
  });
}

export async function saveDomainSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    await setSettings({ "domains.custom": bool(fd, "domains.custom") ? "1" : "0", "domains.mainUsable": bool(fd, "domains.mainUsable") ? "1" : "0", "domains.verifyDns": bool(fd, "domains.verifyDns") ? "1" : "0", "domains.rootRedirect": str(fd, "domains.rootRedirect") });
    revalidatePath("/admin/domains");
    return { ok: true, message: "Settings saved." };
  });
}
