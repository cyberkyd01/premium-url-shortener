"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, int, ids, date } from "@/lib/admin/query";
import { createLink, updateLink, shortUrl, LinkError } from "@/lib/links";
import { sendTemplate } from "@/lib/mail";
import { notify } from "@/lib/notify";
import type { ActionState } from "@/components/ui/form-state";

async function approve(linkIds: string[]) {
  const links = await db.link.findMany({ where: { id: { in: linkIds }, status: "pending" }, include: { user: true, domain: true } });
  await db.link.updateMany({ where: { id: { in: linkIds } }, data: { status: "active" } });
  for (const l of links) {
    if (!l.user) continue;
    await sendTemplate("link-approved", l.user.email, { name: l.user.name ?? l.user.username, short: shortUrl(l), url: l.url }, l.user.language);
    await notify(l.userId, "Link approved", `${shortUrl(l)} is now active.`, { link: `/dashboard/links/${l.id}` });
  }
}

export async function linkQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const link = await db.link.findUnique({ where: { id } });
    if (!link) return { ok: false, error: "Link not found." };
    if (op === "approve") await approve([id]);
    else if (op === "disable") await db.link.update({ where: { id }, data: { status: "disabled" } });
    else if (op === "enable") await db.link.update({ where: { id }, data: { status: "active" } });
    else if (op === "block") await db.link.update({ where: { id }, data: { status: "blocked" } });
    else if (op === "delete") { await db.link.delete({ where: { id } }); revalidatePath("/admin/links"); redirect("/admin/links"); }
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/links"); revalidatePath(`/admin/links/${id}`);
    return { ok: true, message: "Done." };
  });
}

export async function bulkLinks(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one link." };
    if (op === "approve") await approve(selected);
    else if (op === "disable") await db.link.updateMany({ where: { id: { in: selected } }, data: { status: "disabled" } });
    else if (op === "enable") await db.link.updateMany({ where: { id: { in: selected } }, data: { status: "active" } });
    else if (op === "block") await db.link.updateMany({ where: { id: { in: selected } }, data: { status: "blocked" } });
    else if (op === "delete") await db.link.deleteMany({ where: { id: { in: selected } } });
    else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/links");
    return { ok: true, message: `Applied to ${selected.length} links.` };
  });
}

export async function adminCreateLink(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async (admin) => {
    try {
      const ownerName = str(fd, "owner");
      let userId = admin.id;
      if (ownerName) {
        const owner = await db.user.findFirst({ where: { OR: [{ username: ownerName }, { email: ownerName.toLowerCase() }] } });
        if (!owner) return { ok: false, error: "Owner user not found." };
        userId = owner.id;
      }
      const link = await createLink(userId, {
        url: str(fd, "url"), alias: optStr(fd, "alias"), domainId: optStr(fd, "domainId"), title: optStr(fd, "title"), description: optStr(fd, "description"),
        redirectType: str(fd, "redirectType") || "direct", password: optStr(fd, "password"), expiresAt: date(fd, "expiresAt"), clickLimit: int(fd, "clickLimit") || null, notes: optStr(fd, "notes"),
      }, { skipLimits: true });
      if (userId !== admin.id && link.status !== "active") await db.link.update({ where: { id: link.id }, data: { status: "active" } });
      revalidatePath("/admin/links");
      redirect(`/admin/links/${link.id}`);
    } catch (e) {
      if (e instanceof LinkError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

export async function adminUpdateLink(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async (admin) => {
    const id = str(fd, "id");
    try {
      await updateLink(id, admin.id, {
        url: str(fd, "url"), alias: str(fd, "alias"), title: optStr(fd, "title"), description: optStr(fd, "description"), redirectType: str(fd, "redirectType") || "direct",
        expiresAt: date(fd, "expiresAt"), expiredUrl: optStr(fd, "expiredUrl"), clickLimit: int(fd, "clickLimit") || null, notes: optStr(fd, "notes"), isPublic: str(fd, "isPublic") === "1",
        ...(str(fd, "password") ? { password: str(fd, "password") } : {}),
      }, true);
      const status = str(fd, "status");
      if (["active", "pending", "disabled", "blocked"].includes(status)) await db.link.update({ where: { id }, data: { status } });
      revalidatePath("/admin/links"); revalidatePath(`/admin/links/${id}`);
      return { ok: true, message: "Link updated." };
    } catch (e) {
      if (e instanceof LinkError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
