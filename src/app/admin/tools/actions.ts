"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, int, bool } from "@/lib/admin/query";
import { daysAgo } from "@/lib/utils";
import { planFeatures } from "@/lib/plan";
import type { ActionState } from "@/components/ui/form-state";

export async function clearAllCache(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    revalidateTag("settings"); revalidateTag("translations"); revalidatePath("/", "layout");
    return { ok: true, message: "Cache cleared (settings, translations, rendered pages)." };
  });
}

export async function cleanup(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const op = str(fd, "op");
    const days = Math.max(1, int(fd, "days", 90));
    const before = daysAgo(days);
    if (op === "zeroClickLinks") {
      const r = await db.link.deleteMany({ where: { clicks: 0, createdAt: { lt: before }, isPinned: false } });
      return { ok: true, message: `Deleted ${r.count} links older than ${days} days with no clicks.` };
    }
    if (op === "anonymousLinks") {
      const r = await db.link.deleteMany({ where: { userId: null, createdAt: { lt: before } } });
      return { ok: true, message: `Deleted ${r.count} anonymous links older than ${days} days.` };
    }
    if (op === "oldClicks") {
      const r = await db.click.deleteMany({ where: { createdAt: { lt: before } } });
      return { ok: true, message: `Deleted ${r.count} click records older than ${days} days.` };
    }
    if (op === "retentionClicks") {
      const plans = await db.plan.findMany();
      let total = 0;
      for (const plan of plans) {
        const keep = planFeatures(plan).statsRetentionDays;
        if (!keep || keep <= 0) continue;
        const r = await db.click.deleteMany({ where: { createdAt: { lt: daysAgo(keep) }, link: { user: { planId: plan.id } } } });
        total += r.count;
      }
      return { ok: true, message: `Deleted ${total} clicks beyond plan retention.` };
    }
    if (op === "expiredLinks") {
      const r = await db.link.deleteMany({ where: { expiresAt: { lt: new Date() }, userId: null } });
      return { ok: true, message: `Deleted ${r.count} expired anonymous links.` };
    }
    if (op === "notifications") {
      const r = await db.notification.deleteMany({ where: { read: true, createdAt: { lt: before } } });
      return { ok: true, message: `Deleted ${r.count} read notifications older than ${days} days.` };
    }
    if (op === "loginHistory") {
      const r = await db.loginHistory.deleteMany({ where: { createdAt: { lt: before } } });
      return { ok: true, message: `Deleted ${r.count} login history rows older than ${days} days.` };
    }
    return { ok: false, error: "Unknown cleanup." };
  });
}

export async function recountClicks(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const [links, uniques, bios, qrs] = await Promise.all([
      db.click.groupBy({ by: ["linkId"], _count: { _all: true }, where: { linkId: { not: null }, isBot: false } }),
      db.click.groupBy({ by: ["linkId"], _count: { _all: true }, where: { linkId: { not: null }, isBot: false, isUnique: true } }),
      db.click.groupBy({ by: ["bioPageId"], _count: { _all: true }, where: { bioPageId: { not: null }, isBot: false } }),
      db.click.groupBy({ by: ["qrCodeId"], _count: { _all: true }, where: { qrCodeId: { not: null } } }),
    ]);
    const uniqueMap = new Map(uniques.map((u) => [u.linkId, u._count._all]));
    await db.link.updateMany({ data: { clicks: 0, uniqueClicks: 0 } });
    for (let i = 0; i < links.length; i += 100) {
      await db.$transaction(links.slice(i, i + 100).map((l) => db.link.updateMany({ where: { id: l.linkId! }, data: { clicks: l._count._all, uniqueClicks: uniqueMap.get(l.linkId) ?? 0 } })));
    }
    await db.bioPage.updateMany({ data: { views: 0 } });
    for (const b of bios) await db.bioPage.updateMany({ where: { id: b.bioPageId! }, data: { views: b._count._all } });
    await db.qrCode.updateMany({ data: { scans: 0 } });
    for (const q of qrs) await db.qrCode.updateMany({ where: { id: q.qrCodeId! }, data: { scans: q._count._all } });
    return { ok: true, message: `Recounted ${links.length} links, ${bios.length} bio pages and ${qrs.length} QR codes.` };
  });
}

export async function resetDemoData(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async (admin) => {
    if (str(fd, "confirm") !== "RESET") return { ok: false, error: 'Type RESET to confirm.' };
    const keepUsers = bool(fd, "keepUsers");
    await db.click.deleteMany({});
    await db.link.deleteMany({});
    await db.bioPage.deleteMany({});
    await db.qrCode.deleteMany({});
    await db.campaign.deleteMany({});
    await db.report.deleteMany({});
    await db.payment.deleteMany({});
    await db.subscription.deleteMany({});
    await db.ticket.deleteMany({});
    await db.contact.deleteMany({});
    await db.notification.deleteMany({});
    await db.cronLog.deleteMany({});
    if (!keepUsers) await db.user.deleteMany({ where: { NOT: { id: admin.id } } });
    revalidatePath("/", "layout");
    return { ok: true, message: `Demo data reset${keepUsers ? " (users kept)" : ""}.` };
  });
}
