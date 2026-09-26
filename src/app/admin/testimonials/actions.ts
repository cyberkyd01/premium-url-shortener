"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, int, bool } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function saveTestimonial(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("testimonials.manage", async () => {
    const id = optStr(fd, "id");
    const data = { name: str(fd, "name"), role: optStr(fd, "role"), avatar: optStr(fd, "avatar"), content: str(fd, "content"), rating: Math.min(5, Math.max(1, int(fd, "rating", 5))), active: bool(fd, "active"), order: int(fd, "order") };
    if (!data.name || !data.content) return { ok: false, error: "Name and content are required." };
    if (id) await db.testimonial.update({ where: { id }, data }); else await db.testimonial.create({ data });
    revalidatePath("/admin/testimonials"); revalidatePath("/");
    return { ok: true, message: "Testimonial saved." };
  });
}
export async function deleteTestimonial(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("testimonials.manage", async () => { await db.testimonial.delete({ where: { id: str(fd, "id") } }); revalidatePath("/admin/testimonials"); revalidatePath("/"); return { ok: true, message: "Deleted." }; });
}
export async function saveFaq(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("testimonials.manage", async () => {
    const id = optStr(fd, "id");
    const data = { question: str(fd, "question"), answer: str(fd, "answer", 20000), order: int(fd, "order"), active: bool(fd, "active") };
    if (!data.question || !data.answer) return { ok: false, error: "Question and answer are required." };
    if (id) await db.faq.update({ where: { id }, data }); else await db.faq.create({ data });
    revalidatePath("/admin/testimonials"); revalidatePath("/"); revalidatePath("/pricing");
    return { ok: true, message: "FAQ saved." };
  });
}
export async function deleteFaq(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("testimonials.manage", async () => { await db.faq.delete({ where: { id: str(fd, "id") } }); revalidatePath("/admin/testimonials"); revalidatePath("/"); return { ok: true, message: "Deleted." }; });
}
