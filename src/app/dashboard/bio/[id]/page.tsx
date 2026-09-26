import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { Alert } from "@/components/ui";
import { BuilderScreen } from "../builder-loader";

export const metadata = { title: "Edit bio page" };

export default async function EditBioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["bio.enabled"] !== "1") return <Alert type="warning">Bio pages are currently disabled.</Alert>;
  if (!can(ws, "bio", "edit")) return <Alert type="error">You do not have permission to edit bio pages.</Alert>;
  const page = await db.bioPage.findFirst({ where: { id, userId: ws.ownerId }, include: { blocks: { orderBy: { order: "asc" } } } });
  if (!page) notFound();
  const { blocks, ...rest } = page;
  return <BuilderScreen ws={ws} page={rest} blocks={blocks} />;
}
