import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { PageHeader, Alert } from "@/components/ui";
import { LiveFeed } from "@/components/premium/live-feed";

export const metadata = { title: "Live analytics" };

export default async function LivePage({ searchParams }: { searchParams: Promise<{ linkId?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "links", "stats")) return <Alert type="error">You do not have permission to view statistics in this team.</Alert>;
  const { linkId } = await searchParams;
  const links = await db.link.findMany({ where: { userId: ws.ownerId, isArchived: false }, select: { id: true, alias: true, title: true }, orderBy: { clicks: "desc" }, take: 500 });
  const initial = linkId && links.some((l) => l.id === linkId) ? linkId : null;
  return (
    <>
      <PageHeader title="Live analytics" description="Clicks on your links as they happen. Updates every few seconds." />
      <LiveFeed links={links} initialLinkId={initial} />
    </>
  );
}
