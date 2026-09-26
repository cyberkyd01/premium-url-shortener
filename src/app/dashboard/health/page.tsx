import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Pencil, RefreshCw, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { healthOverview } from "@/lib/health";
import { shortUrl } from "@/lib/links";
import { formatDate, truncate } from "@/lib/utils";
import { PageHeader, Stat, Card, Badge, Alert, Empty } from "@/components/ui";
import { ActionButton } from "@/components/premium/action-button";
import { checkAllLinks, checkLinkNow } from "./actions";

export const metadata = { title: "Link health" };

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "links", "stats")) return <Alert type="error">You do not have permission to view link health in this team.</Alert>;
  const { view } = await searchParams;
  const showAll = view === "all";
  const [overview, broken, recentChecks, all] = await Promise.all([
    healthOverview(ws.ownerId),
    db.link.findMany({ where: { userId: ws.ownerId, healthStatus: "broken", isArchived: false }, include: { domain: true, checks: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { healthCheckedAt: "desc" }, take: 200 }),
    db.linkCheck.findMany({ where: { link: { userId: ws.ownerId } }, orderBy: { createdAt: "desc" }, take: 15, include: { link: { select: { alias: true, id: true } } } }),
    showAll ? db.link.findMany({ where: { userId: ws.ownerId, isArchived: false }, include: { domain: true }, orderBy: [{ healthCheckedAt: { sort: "asc", nulls: "first" } }], take: 300 }) : Promise.resolve([]),
  ]);
  const withoutFallback = broken.filter((l) => !l.fallbackUrl).length;

  return (
    <>
      <PageHeader title="Link health" description="We periodically check your destinations and alert you when one breaks. Set a fallback URL so visitors are never left on an error page."
        actions={<>
          <Link href={showAll ? "/dashboard/health" : "/dashboard/health?view=all"} className="btn-secondary btn-sm">{showAll ? "Show broken only" : "Show all links"}</Link>
          <ActionButton action={checkAllLinks} variant="primary" showMessage={false}><RefreshCw size={14} /> Check all my links</ActionButton>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label="Healthy" value={<span className="text-success">{overview.healthy}</span>} sub="Destination responded 2xx/3xx" />
        <Stat label="Broken" value={<span className={overview.broken ? "text-danger" : ""}>{overview.broken}</span>} sub={withoutFallback ? `${withoutFallback} without a fallback URL` : "All broken links have a fallback"} />
        <Stat label="Unchecked" value={overview.unchecked} sub="Never checked yet" />
        <Stat label="Total links" value={overview.total} sub="Excluding archived" />
      </div>

      {overview.broken > 0 && withoutFallback > 0 && (
        <div className="mb-4"><Alert type="warning"><b>{withoutFallback}</b> broken {withoutFallback === 1 ? "link has" : "links have"} no fallback URL. Edit the link and set a <b>fallback URL</b>: while the destination is down, visitors are redirected there automatically.</Alert></div>
      )}

      <Card title={showAll ? "All links" : "Broken links"} description={showAll ? "Least recently checked first" : "Destinations that failed the last check"} className="mb-4">
        {(showAll ? all : broken).length === 0 ? (
          <Empty title={showAll ? "No links yet" : "No broken links"} description={showAll ? "Create a short link to start monitoring it." : overview.unchecked ? "Run a check to verify your unchecked links." : "All your destinations are responding."} action={!showAll && overview.unchecked ? <ActionButton action={checkAllLinks} variant="primary" showMessage={false}><RefreshCw size={14} /> Check my links</ActionButton> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>Link</th><th>Destination</th><th>Status</th><th>Last check</th><th>Fallback</th><th className="text-right">Actions</th></tr></thead>
            <tbody>{(showAll ? all : broken).map((l) => {
              const lastError = "checks" in l && Array.isArray(l.checks) && l.checks[0] ? l.checks[0].error : null;
              return (
                <tr key={l.id}>
                  <td><Link href={`/dashboard/links/${l.id}`} className="font-medium text-primary">/{l.alias}</Link>{l.title && <div className="text-xs text-muted truncate max-w-[14rem]">{l.title}</div>}<div className="text-xs text-muted">{shortUrl(l).replace(/^https?:\/\//, "")}</div></td>
                  <td className="text-xs text-muted max-w-[16rem] truncate" title={l.url}>{truncate(l.url, 50)}</td>
                  <td>
                    {l.healthStatus === "ok" && <Badge color="green">OK{l.healthCode ? ` · ${l.healthCode}` : ""}</Badge>}
                    {l.healthStatus === "broken" && <Badge color="red">{l.healthCode ? `HTTP ${l.healthCode}` : "Unreachable"}</Badge>}
                    {l.healthStatus === "unknown" && <Badge color="gray">Unchecked</Badge>}
                    {lastError && l.healthStatus === "broken" && <div className="text-xs text-muted mt-1 max-w-[12rem] truncate" title={lastError}>{lastError}</div>}
                  </td>
                  <td className="text-xs text-muted whitespace-nowrap">{l.healthCheckedAt ? formatDate(l.healthCheckedAt, true) : "Never"}</td>
                  <td className="text-xs">{l.fallbackUrl ? <span className="text-success truncate max-w-[10rem] inline-block" title={l.fallbackUrl}>{truncate(l.fallbackUrl, 30)}</span> : <Link href={`/dashboard/links/${l.id}/edit`} className="text-warning">Set fallback</Link>}</td>
                  <td className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <ActionButton action={checkLinkNow} hidden={{ id: l.id }} showMessage={false}><Activity size={12} /> Check now</ActionButton>
                      {can(ws, "links", "edit") && <Link href={`/dashboard/links/${l.id}/edit`} className="btn-ghost btn-sm"><Pencil size={12} /> Edit</Link>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Recent checks" className="lg:col-span-2">
          {recentChecks.length === 0 ? <p className="text-sm text-muted">No checks recorded yet.</p> : (
            <div className="overflow-x-auto -m-5"><table className="table">
              <thead><tr><th>Time</th><th>Link</th><th>Result</th><th>Latency</th></tr></thead>
              <tbody>{recentChecks.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(c.createdAt, true)}</td>
                  <td className="text-xs"><Link href={`/dashboard/links/${c.link.id}`} className="text-primary">/{c.link.alias}</Link></td>
                  <td className="text-xs">{c.ok ? <Badge color="green">OK {c.status ?? ""}</Badge> : <Badge color="red">{c.error ?? `HTTP ${c.status}`}</Badge>}</td>
                  <td className="text-xs text-muted">{c.latencyMs != null ? `${c.latencyMs} ms` : "-"}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="How it works">
          <ul className="text-sm text-muted space-y-2">
            <li className="flex gap-2"><ShieldAlert size={16} className="shrink-0 text-primary mt-0.5" /><span>Destinations are checked with a HEAD request (falling back to GET) with an 8 second timeout, following redirects.</span></li>
            <li className="flex gap-2"><Activity size={16} className="shrink-0 text-primary mt-0.5" /><span>The scheduled job checks the least recently verified links first. &quot;Check all my links&quot; runs up to 50 at once.</span></li>
            <li className="flex gap-2"><RefreshCw size={16} className="shrink-0 text-primary mt-0.5" /><span>When a link flips from healthy to broken you get a notification and an email, once. Fix the destination or set a fallback URL in the link editor.</span></li>
          </ul>
        </Card>
      </div>
    </>
  );
}
