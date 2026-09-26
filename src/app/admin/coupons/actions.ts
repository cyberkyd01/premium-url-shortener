"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, num, int, bool, date } from "@/lib/admin/query";
import { randomToken } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

function code(prefix = "") {
  return (prefix + randomToken(4)).toUpperCase().slice(0, 24);
}

export async function saveCoupon(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    const id = optStr(fd, "id");
    const isVoucher = bool(fd, "isVoucher");
    const base = {
      type: str(fd, "type") === "fixed" ? "fixed" : "percent", amount: num(fd, "amount"), planId: optStr(fd, "planId"), maxUses: int(fd, "maxUses", -1),
      isVoucher, voucherDays: int(fd, "voucherDays", 30), expiresAt: date(fd, "expiresAt"), active: bool(fd, "active"),
    };
    if (isVoucher && !base.planId) return { ok: false, error: "Vouchers must be restricted to a plan (the plan they grant)." };
    if (!isVoucher && base.amount <= 0) return { ok: false, error: "Amount must be greater than zero." };
    const count = Math.min(500, Math.max(1, int(fd, "count", 1)));
    if (id) {
      await db.coupon.update({ where: { id }, data: { ...base, code: (str(fd, "code") || code()).toUpperCase() } });
    } else if (count > 1) {
      const prefix = str(fd, "prefix").toUpperCase().replace(/[^A-Z0-9-]/g, "");
      for (let i = 0; i < count; i++) {
        let c = code(prefix);
        while (await db.coupon.findUnique({ where: { code: c } })) c = code(prefix);
        await db.coupon.create({ data: { ...base, code: c } });
      }
      revalidatePath("/admin/coupons");
      return { ok: true, message: `Generated ${count} codes.` };
    } else {
      const c = (str(fd, "code") || code(str(fd, "prefix"))).toUpperCase();
      if (await db.coupon.findUnique({ where: { code: c } })) return { ok: false, error: "Code already exists." };
      await db.coupon.create({ data: { ...base, code: c } });
    }
    revalidatePath("/admin/coupons");
    return { ok: true, message: "Saved." };
  });
}

export async function couponQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    if (op === "toggle") { const c = await db.coupon.findUnique({ where: { id } }); if (c) await db.coupon.update({ where: { id }, data: { active: !c.active } }); }
    else if (op === "delete") await db.coupon.delete({ where: { id } });
    revalidatePath("/admin/coupons");
    return { ok: true, message: "Done." };
  });
}
