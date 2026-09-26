import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { appHostname, serverIps } from "@/lib/domain-verify";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, Empty, Alert, Badge, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { AddDomainButton, EditDomainButton, VerifyDomainButton, RefreshSslButton } from "./domain-forms";
import { cloudflareConfig } from "@/lib/cloudflare";
import { SslBadge } from "@/app/admin/cloudflare/ssl-badge";
import { deleteDomain } from "./actions";
import { Trash2, Globe } from "lucide-react";

export const metadata = { title: "Custom domains" };

export default async function DomainsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [s, { plan, user }, limit, domains, publicDomains, ips, cf] = await Promise.all([
    getSettings(),
    getUserPlan(ws.ownerId),
    withinLimit(ws.ownerId, "limitDomains"),
    db.domain.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { links: true, bioPages: true } } } }),
    db.domain.findMany({ where: { isPublic: true, status: 1 }, orderBy: [{ isMain: "desc" }, { domain: "asc" }] }),
    serverIps(),
    cloudflareConfig(),
  ]);
  const settingEnabled = s["domains.custom"] === "1";
  const planEnabled = user.role === "admin" || (plan?.limitDomains ?? 0) !== 0;
  const enabled = settingEnabled && planEnabled;
  const host = appHostname();
  const cfTarget = cf.enabled ? cf.fallbackOrigin || host : "";
  const verifyDns = s["domains.verifyDns"] === "1";
  const dnsHint = cfTarget
    ? `Create a CNAME record for your domain pointing to ${cfTarget}. An SSL certificate is issued automatically once DNS resolves.`
    : ips.length
    ? `Create an A record for your domain pointing to ${ips.join(" or ")}, or a CNAME record pointing to ${host}.`
    : `Create a CNAME record for your domain pointing to ${host} (or an A record to this server's IP address).`;
  const canCreate = enabled && limit.ok && can(ws, "domains", "create");
  return (
    <div>
      <PageHeader title="Custom domains" description="Use your own branded domains for short links and bio pages."
        actions={<>{enabled && limit.limit > 0 && <span className="text-sm text-muted">{domains.length} / {limit.limit} used</span>}{enabled && can(ws, "domains", "create") && <AddDomainButton disabled={!limit.ok} disabledHint="Domain limit reached" dnsHint={dnsHint} />}</>} />
      {!settingEnabled && <div className="mb-4"><Alert type="info">Custom domains are currently disabled by the administrator.</Alert></div>}
      {settingEnabled && !planEnabled && <div className="mb-4"><Alert type="warning">Custom domains are not included in your current plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to brand your links with your own domain.</Alert></div>}
      {enabled && !limit.ok && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit.limit} custom domains on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to add more.</Alert></div>}

      {enabled && cfTarget && (
        <Card title="DNS setup (automatic SSL)" description="Point your domain to our edge with a CNAME record. HTTPS is provisioned automatically." className="mb-6">
          <div className="rounded-lg border border-border p-4 text-sm"><p className="font-medium mb-1">CNAME record</p><p className="text-muted">Type <code className="font-mono">CNAME</code>, host <code className="font-mono">links</code> (your subdomain, or <code className="font-mono">@</code> if your DNS provider supports CNAME flattening), value <code className="font-mono">{cfTarget}</code></p></div>
          <p className="text-xs text-muted mt-3">After the record propagates, add the domain here. The SSL certificate is usually active within a few minutes; use the <strong>SSL</strong> button to refresh its status.</p>
        </Card>
      )}
      {enabled && !cfTarget && (
        <Card title="DNS setup" description="Point your domain to this server before adding it." className="mb-6">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-border p-4"><p className="font-medium mb-1">Option A — A record</p><p className="text-muted">Type <code className="font-mono">A</code>, host <code className="font-mono">@</code> (or your subdomain), value <code className="font-mono">{ips[0] ?? "this server's IP"}</code></p></div>
            <div className="rounded-lg border border-border p-4"><p className="font-medium mb-1">Option B — CNAME record</p><p className="text-muted">Type <code className="font-mono">CNAME</code>, host <code className="font-mono">links</code> (your subdomain), value <code className="font-mono">{host}</code></p></div>
          </div>
          <p className="text-xs text-muted mt-3">{verifyDns ? "Domains stay pending until the DNS check succeeds — click Verify after your DNS has propagated (up to 24 hours)." : "Domains are activated immediately; make sure DNS is configured so links resolve."} Once the domain resolves, <code className="font-mono">https://your-domain/domain-check</code> must display &quot;Your domain name is working&quot;.</p>
        </Card>
      )}

      <Card title="Your domains" className="mb-6">
        {domains.length === 0 ? (
          <Empty title="No custom domains yet" description="Add a domain you own to create branded short links." action={canCreate ? <AddDomainButton dnsHint={dnsHint} /> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Domain</th><th>Status</th><th>Root redirect</th><th>Links</th><th>Added</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id}>
                    <td><span className="flex items-center gap-2 font-medium"><Globe size={16} className="text-muted" />{d.domain}</span>{d.notFoundRedirect && <p className="text-xs text-muted">404 → {d.notFoundRedirect}</p>}</td>
                    <td><div className="flex flex-wrap gap-1">{d.status === 1 ? <Badge color="green">Active</Badge> : <Badge color="yellow">Pending verification</Badge>}{cf.enabled && <SslBadge status={d.cfStatus} ssl={d.cfSslStatus} />}</div>{cf.enabled && d.cfStatus === "error" && d.cfSslStatus && <p className="text-xs text-danger mt-1 max-w-xs truncate" title={d.cfSslStatus}>{d.cfSslStatus}</p>}</td>
                    <td className="text-muted text-xs max-w-xs truncate">{d.rootRedirect ?? "—"}</td>
                    <td>{d._count.links}{d._count.bioPages > 0 && <span className="text-muted text-xs"> + {d._count.bioPages} bio</span>}</td>
                    <td className="text-muted">{formatDate(d.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {d.status !== 1 && can(ws, "domains", "edit") && <VerifyDomainButton id={d.id} />}
                        {cf.enabled && d.status === 1 && can(ws, "domains", "edit") && <RefreshSslButton id={d.id} />}
                        {can(ws, "domains", "edit") && enabled && <EditDomainButton domain={{ id: d.id, domain: d.domain, rootRedirect: d.rootRedirect, notFoundRedirect: d.notFoundRedirect }} />}
                        {can(ws, "domains", "delete") && <ConfirmForm action={deleteDomain} hidden={{ id: d.id }} message={`Delete ${d.domain}? ${d._count.links} link(s) and ${d._count.bioPages} bio page(s) on this domain will be moved to the main domain and will no longer resolve on ${d.domain}.`}><Button type="submit" variant="ghost" size="sm" className="text-danger" title="Delete"><Trash2 size={14} /></Button></ConfirmForm>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Shared domains" description="Domains provided by the service that you can select when creating links.">
        {publicDomains.length === 0 ? <p className="text-sm text-muted">Only the main domain ({host}) is available.</p> : (
          <ul className="divide-y divide-border -m-5">
            <li className="flex items-center justify-between px-5 py-3 text-sm"><span className="flex items-center gap-2"><Globe size={14} className="text-muted" />{host}</span><Badge color="blue">Main</Badge></li>
            {publicDomains.map((d) => <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm"><span className="flex items-center gap-2"><Globe size={14} className="text-muted" />{d.domain}</span>{d.isMain ? <Badge color="blue">Main</Badge> : <Badge color="gray">Shared</Badge>}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
