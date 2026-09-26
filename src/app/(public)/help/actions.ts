"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/** "Was this helpful?" counter for help articles. */
export async function markHelpful(articleId: string): Promise<{ ok: boolean }> {
  const a = await db.helpArticle.findUnique({ where: { id: articleId }, select: { slug: true, category: { select: { slug: true } } } });
  if (!a) return { ok: false };
  await db.helpArticle.update({ where: { id: articleId }, data: { helpful: { increment: 1 } } });
  revalidatePath(`/help/${a.category?.slug ?? "general"}/${a.slug}`);
  return { ok: true };
}
