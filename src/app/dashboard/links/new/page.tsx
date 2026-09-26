import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkspace, can } from "@/lib/workspace";
import { withinLimit } from "@/lib/plan";
import { PageHeader, Alert } from "@/components/ui";
import { LinkForm } from "@/components/links/link-form";
import { loadLinkFormOptions } from "@/components/links/form-options";

export const metadata = { title: "Shorten link" };

export default async function NewLinkPage({ searchParams }: { searchParams: Promise<{ url?: string; title?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { url, title } = await searchParams;
  const options = await loadLinkFormOptions(ws);
  const limit = await withinLimit(ws.ownerId, "limitLinks");
  const monthly = await withinLimit(ws.ownerId, "limitLinksMonthly");
  return (
    <>
      <PageHeader title="Shorten a link" description="Create a short link with targeting, tracking and branding options." actions={<Link href="/dashboard/links" className="btn-secondary btn-sm">Back to links</Link>} />
      {!can(ws, "links", "create") ? <Alert type="error">You do not have permission to create links in this team.</Alert>
        : !limit.ok ? <Alert type="warning">You have reached your plan limit of {limit.limit} links. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to add more.</Alert>
        : !monthly.ok ? <Alert type="warning">You have reached your monthly limit of {monthly.limit} links.</Alert>
        : <LinkForm options={options} initial={url ? { url, title: title?.slice(0, 200) || null } : undefined} />}
    </>
  );
}
