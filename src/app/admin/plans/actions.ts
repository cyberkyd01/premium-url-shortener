"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, num, int, bool, list } from "@/lib/admin/query";
import { slugify } from "@/lib/utils";
import { DEFAULT_FEATURES, ALL_REDIRECT_TYPES, ALL_QR_TYPES, type PlanFeatures } from "@/lib/plan";
import { LIMIT_FIELDS } from "@/lib/admin/plan-meta";
import type { ActionState } from "@/components/ui/form-state";

function featuresFrom(fd: FormData): PlanFeatures {
  const out = { ...DEFAULT_FEATURES } as Record<string, boolean | number | string[]>;
  for (const [k, v] of Object.entries(DEFAULT_FEATURES)) {
    if (typeof v === "boolean") out[k] = bool(fd, `f.${k}`);
  }
  out.redirectTypes = list(fd, "f.redirectTypes").filter((t) => ALL_REDIRECT_TYPES.includes(t));
  out.qrTypes = list(fd, "f.qrTypes").filter((t) => ALL_QR_TYPES.includes(t));
  out.statsRetentionDays = int(fd, "f.statsRetentionDays", 30);
  return out as unknown as PlanFeatures;
}

export async function savePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    const id = optStr(fd, "id");
    const name = str(fd, "name");
    if (!name) return { ok: false, error: "Name is required." };
    const slug = slugify(str(fd, "slug") || name);
    if (await db.plan.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already in use." };
    const limits: Record<string, number> = {};
    for (const f of LIMIT_FIELDS) limits[f.key] = int(fd, f.key, -1);
    const data = {
      name, slug, description: optStr(fd, "description"), priceMonthly: num(fd, "priceMonthly"), priceYearly: num(fd, "priceYearly"), priceLifetime: num(fd, "priceLifetime"),
      currency: str(fd, "currency") || "USD", isFree: bool(fd, "isFree"), isPublic: bool(fd, "isPublic"), isFeatured: bool(fd, "isFeatured"), sortOrder: int(fd, "sortOrder"), trialDays: int(fd, "trialDays"),
      ...limits, features: JSON.stringify(featuresFrom(fd)),
    };
    const plan = id ? await db.plan.update({ where: { id }, data }) : await db.plan.create({ data });
    revalidatePath("/admin/plans"); revalidatePath("/pricing");
    if (!id) redirect(`/admin/plans/${plan.id}`);
    return { ok: true, message: "Plan saved." };
  });
}

export async function deletePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    const id = str(fd, "id");
    const plan = await db.plan.findUnique({ where: { id } });
    if (!plan) return { ok: false, error: "Plan not found." };
    const free = await db.plan.findFirst({ where: { isFree: true, NOT: { id } } });
    if (plan.isFree && !free) return { ok: false, error: "Cannot delete the only free plan." };
    await db.user.updateMany({ where: { planId: id }, data: { planId: free?.id ?? null, planExpires: null } });
    await db.subscription.updateMany({ where: { planId: id }, data: { status: "cancelled" } });
    await db.coupon.updateMany({ where: { planId: id }, data: { planId: null } });
    await db.payment.updateMany({ where: { planId: id }, data: { planId: null } });
    await db.subscription.deleteMany({ where: { planId: id } });
    await db.plan.delete({ where: { id } });
    revalidatePath("/admin/plans");
    redirect("/admin/plans");
  });
}

export async function reorderPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    await db.plan.update({ where: { id: str(fd, "id") }, data: { sortOrder: int(fd, "sortOrder") } });
    revalidatePath("/admin/plans");
    return { ok: true };
  });
}

export async function syncPlans(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("payments.manage", async () => {
    const gateway = str(fd, "gateway");
    try {
      const payments = await import("@/lib/payments");
      const fn = gateway === "stripe" ? payments.syncPlansWithStripe : gateway === "paypal" ? payments.syncPlansWithPayPal : gateway === "paddle" ? payments.syncPlansWithPaddle : gateway === "paystack" ? payments.syncPlansWithPaystack : null;
      if (!fn) return { ok: false, error: `Plan sync is not supported for ${gateway}.` };
      const res = await fn();
      revalidatePath("/admin/plans");
      return { ok: true, message: `Synced ${res.synced} plan(s) with ${gateway}.` };
    } catch (e) {
      return { ok: false, error: `Sync failed: ${e instanceof Error ? e.message : "payments module unavailable"}` };
    }
  });
}
