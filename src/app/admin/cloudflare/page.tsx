import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { cloudflareConfig } from "@/lib/cloudflare";
import { formatDate } from "@/lib/utils";
import { Card, Input, PageHeader, Stat } from "@/components/ui";
import { SslBadge } from "./ssl-badge";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { Table } from "@/components/admin/table";
import { saveCloudflareSettings, syncCloudflareHostnames, testCloudflareConnection } from "./actions";

export default async function CloudflareAdmin() {
  await adminPage("settings.manage");
  const cfg = await cloudflareConfig();
  const domains = await db.domain.findMany({ where: { userId: { not: null } }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, username: true } } }, take: 100 });
  const active = domains.filter((d) => d.cfStatus === "active" && d.cfSslStatus === "active").length;
  const pending = domains.filter((d) => d.cfHostnameId && !(d.cfStatus === "active" && d.cfSslStatus === "active") && d.cfStatus !== "error").length;
  const errors = domains.filter((d) => d.cfStatus === "error").length;
  return (
    <div>
      <PageHeader title="Cloudflare SaaS SSL" description="Issue SSL certificates for user custom domains automatically through Cloudflare for SaaS (Custom Hostnames)." />
      <div className="grid sm:grid-cols-3 gap-4 mb-6"><Stat label="SSL active" value={active} /><Stat label="Pending" value={pending} /><Stat label="Errors" value={errors} /></div>
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2" title="Settings" description={<a href="https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/" target="_blank" rel="noreferrer" className="text-primary">Cloudflare for SaaS documentation ↗</a>}>
          <ActionForm action={saveCloudflareSettings} submitLabel="Save settings">
            <SwitchField name="enabled" label="Enable automatic SSL provisioning" hint="New and verified custom domains are registered as custom hostnames on your zone." defaultChecked={cfg.enabled} />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Zone ID" name="zoneId" defaultValue={cfg.zoneId} placeholder="023e105f4ecef8ad9ca31a8372d0c353" hint="Cloudflare dashboard → your zone → Overview → API section." />
              <Input label="API token" name="apiToken" type="password" autoComplete="new-password" placeholder={cfg.apiToken ? "•••••••• (saved, leave blank to keep)" : "Token with SSL and Certificates: Edit"} />
              <input type="hidden" name="keepToken" value="1" />
            </div>
            <Input label="Fallback origin (CNAME target)" name="fallbackOrigin" defaultValue={cfg.fallbackOrigin} placeholder="ssl.yourdomain.com" hint="Users point their domain to this hostname. It must be set as the fallback origin of the zone and proxied to this server." />
          </ActionForm>
          <div className="mt-4 flex flex-wrap gap-2"><ActionButton action={testCloudflareConnection}>Test connection</ActionButton><ActionButton action={syncCloudflareHostnames} variant="primary">Provision missing hostnames</ActionButton></div>
        </Card>
        <Card title="How it works">
          <ol className="text-sm text-muted space-y-2 list-decimal pl-4">
            <li>Enable <strong>Cloudflare for SaaS</strong> on the zone and set its <strong>fallback origin</strong> (e.g. <code>ssl.yourdomain.com</code>) pointing to this server.</li>
            <li>Create an API token with permission <em>Zone → SSL and Certificates → Edit</em> for that zone.</li>
            <li>Users add a domain and create a CNAME to the fallback origin. The app registers the hostname; Cloudflare validates it over HTTP and issues the certificate within minutes.</li>
            <li>Statuses are refreshed when users click <em>Refresh SSL status</em> or when you sync here.</li>
          </ol>
          <p className="text-xs text-muted mt-3">Manage domains on the <Link href="/admin/domains" className="text-primary">Domains</Link> page.</p>
        </Card>
      </div>
      <h2 className="font-semibold mb-2">User domains</h2>
      <Table count={domains.length} head={["Domain", "User", "Hostname id", "SSL", "Added", ""]}>
        {domains.map((d) => (
          <tr key={d.id}>
            <td className="font-medium">{d.domain}</td>
            <td>{d.user && <Link href={`/admin/users/${d.user.id}`}>{d.user.username}</Link>}</td>
            <td className="font-mono text-xs text-muted">{d.cfHostnameId ?? "—"}</td>
            <td><SslBadge status={d.cfStatus} ssl={d.cfSslStatus} />{d.cfStatus === "error" && d.cfSslStatus && <p className="text-xs text-danger mt-1 max-w-xs">{d.cfSslStatus}</p>}</td>
            <td className="text-muted">{formatDate(d.createdAt)}</td>
            <td><ActionButton action={syncCloudflareHostnames} hidden={{ id: d.id }} showMessage={false}>{d.cfHostnameId ? "Refresh" : "Provision"}</ActionButton></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
