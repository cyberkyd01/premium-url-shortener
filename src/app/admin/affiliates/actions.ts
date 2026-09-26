"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import { setSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

export async function saveAffiliateSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("affiliates.manage", async () => {
    await setSettings({
      "affiliate.enabled": bool(fd, "affiliate.enabled") ? "1" : "0", "affiliate.commission": str(fd, "affiliate.commission") || "20",
      "affiliate.commissionType": str(fd, "affiliate.commissionType") === "fixed" ? "fixed" : "percent", "affiliate.frequency": str(fd, "affiliate.frequency") === "recurring" ? "recurring" : "first",
      "affiliate.minPayout": str(fd, "affiliate.minPayout") || "50", "affiliate.cookieDays": str(fd, "affiliate.cookieDays") || "30", "affiliate.tagType": str(fd, "affiliate.tagType") === "username" ? "username" : "code",
    });
    revalidatePath("/admin/affiliates");
    return { ok: true, message: "Affiliate settings saved." };
  });
}

export async function earningQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("affiliates.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const e = await db.affiliateEarning.findUnique({ where: { id } });
    if (!e) return { ok: false, error: "Earning not found." };
    if (op === "approve" && e.status === "pending") {
      await db.affiliateEarning.update({ where: { id }, data: { status: "approved" } });
      await db.user.update({ where: { id: e.userId }, data: { affiliateBalance: { increment: e.amount } } });
    } else if (op === "delete") {
      if (e.status === "approved") await db.user.update({ where: { id: e.userId }, data: { affiliateBalance: { decrement: e.amount } } });
      await db.affiliateEarning.delete({ where: { id } });
    } else return { ok: false, error: "Nothing to do." };
    revalidatePath("/admin/affiliates");
    return { ok: true, message: "Done." };
  });
}

export async function payoutQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("affiliates.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const p = await db.affiliatePayout.findUnique({ where: { id }, include: { user: true } });
    if (!p) return { ok: false, error: "Payout not found." };
    if (op === "paid" && p.status === "pending") {
      await db.affiliatePayout.update({ where: { id }, data: { status: "paid", paidAt: new Date() } });
      await db.affiliateEarning.updateMany({ where: { userId: p.userId, status: "approved" }, data: { status: "paid" } });
      await sendTemplate("affiliate-payout", p.user.email, { name: p.user.name ?? p.user.username, amount: formatMoney(p.amount), method: p.method }, p.user.language);
      await notify(p.userId, "Payout sent", `Your payout of ${formatMoney(p.amount)} was processed.`, { link: "/dashboard/affiliate" });
    } else if (op === "reject" && p.status === "pending") {
      await db.affiliatePayout.update({ where: { id }, data: { status: "rejected" } });
      await db.user.update({ where: { id: p.userId }, data: { affiliateBalance: { increment: p.amount } } });
      await notify(p.userId, "Payout rejected", `Your payout request of ${formatMoney(p.amount)} was rejected and the balance restored.`);
    } else if (op === "delete") await db.affiliatePayout.delete({ where: { id } });
    else return { ok: false, error: "Nothing to do." };
    revalidatePath("/admin/affiliates");
    return { ok: true, message: "Done." };
  });
}
