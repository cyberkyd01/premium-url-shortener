"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str } from "@/lib/admin/query";
import { sendTemplate } from "@/lib/mail";
import { notify } from "@/lib/notify";
import type { ActionState } from "@/components/ui/form-state";

export async function reviewVerification(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("verification.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const req = await db.verificationRequest.findUnique({ where: { id }, include: { user: true } });
    if (!req) return { ok: false, error: "Request not found." };
    if (op === "delete") { await db.verificationRequest.delete({ where: { id } }); revalidatePath("/admin/verifications"); return { ok: true, message: "Deleted." }; }
    if (op === "approve") {
      if (req.type === "badge") await db.user.update({ where: { id: req.userId }, data: { verified: true } });
      else if (req.type === "2fa_reset") await db.user.update({ where: { id: req.userId }, data: { twoFactorEnabled: false, twoFactorSecret: null, emailOtp: null } });
      else if (req.type === "email") await db.user.update({ where: { id: req.userId }, data: { emailVerified: new Date(), status: req.user.status === 2 ? 1 : req.user.status, verificationToken: null } });
      await db.verificationRequest.update({ where: { id }, data: { status: "approved" } });
      await sendTemplate("verification-approved", req.user.email, { name: req.user.name ?? req.user.username, type: req.type }, req.user.language);
      await notify(req.userId, "Verification approved", `Your ${req.type.replace("_", " ")} request was approved.`);
    } else if (op === "reject") {
      await db.verificationRequest.update({ where: { id }, data: { status: "rejected" } });
      await notify(req.userId, "Verification rejected", `Your ${req.type.replace("_", " ")} request was rejected.`);
    } else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/verifications");
    return { ok: true, message: op === "approve" ? "Approved." : "Rejected." };
  });
}
