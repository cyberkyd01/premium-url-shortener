import { redirect } from "next/navigation";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { withinLimit } from "@/lib/plan";
import { randomAlias } from "@/lib/utils";
import { Alert } from "@/components/ui";
import { BuilderScreen } from "../builder-loader";
import { db } from "@/lib/db";

export const metadata = { title: "New bio page" };

export default async function NewBioPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["bio.enabled"] !== "1") return <Alert type="warning">Bio pages are currently disabled.</Alert>;
  if (!can(ws, "bio", "create")) return <Alert type="error">You do not have permission to create bio pages.</Alert>;
  const lim = await withinLimit(ws.ownerId, "limitBioPages");
  if (!lim.ok) return <Alert type="warning">You reached the bio page limit of your plan ({lim.limit}). Please upgrade to create more.</Alert>;
  // pick a free alias suggestion
  let alias = randomAlias(6).toLowerCase();
  for (let i = 0; i < 5; i++) { const taken = await db.bioPage.findFirst({ where: { alias, domainId: null }, select: { id: true } }); if (!taken) break; alias = randomAlias(6).toLowerCase(); }
  return <BuilderScreen ws={ws} page={null} blocks={[]} suggestedAlias={alias} />;
}
