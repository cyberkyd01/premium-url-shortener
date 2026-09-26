"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool } from "@/lib/admin/query";
import { sendTemplate } from "@/lib/mail";
import type { ActionState } from "@/components/ui/form-state";

export async function saveEmailTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const id = optStr(fd, "id");
    const slug = str(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "-"), subject = str(fd, "subject"), body = str(fd, "body", 200000), language = str(fd, "language") || "en";
    if (!slug || !subject || !body) return { ok: false, error: "Slug, subject and body are required." };
    const dup = await db.emailTemplate.findFirst({ where: { slug, language, ...(id ? { NOT: { id } } : {}) } });
    if (dup) return { ok: false, error: "A template with this slug and language already exists." };
    const data = { slug, subject, body, language, active: bool(fd, "active") };
    if (id) await db.emailTemplate.update({ where: { id }, data }); else await db.emailTemplate.create({ data });
    revalidatePath("/admin/emails");
    return { ok: true, message: "Template saved." };
  });
}
export async function deleteEmailTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => { await db.emailTemplate.delete({ where: { id: str(fd, "id") } }); revalidatePath("/admin/emails"); return { ok: true, message: "Deleted." }; });
}
export async function sendTemplateTest(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async (admin) => {
    const t = await db.emailTemplate.findUnique({ where: { id: str(fd, "id") } });
    if (!t) return { ok: false, error: "Template not found." };
    const to = str(fd, "to") || admin.email;
    const vars: Record<string, string> = { name: admin.name || admin.username, username: admin.username, link: "https://example.com/link", code: "123456", team: "Acme", inviter: "Jane", amount: "$9.00", plan: "Pro", invoice: "INV-000001", date: new Date().toDateString(), short: "https://example.com/abc", number: "42", subject: "Sample ticket", email: admin.email, message: "Sample message", type: "badge", url: "https://example.com", interval: "monthly", method: "paypal" };
    const ok = await sendTemplate(t.slug, to, vars, t.language);
    return ok ? { ok: true, message: `Test sent to ${to}.` } : { ok: false, error: "Sending failed; check mail settings." };
  });
}
