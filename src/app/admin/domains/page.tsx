import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appHost, formatDate } from "@/lib/utils";
import { Card, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { Table, StatusBadge } from "@/components/admin/table";
import { addAdminDomains, updateDomain, domainQuick, saveDomainSettings } from "./actions";
import { cloudflareConfig } from "@/lib/cloudflare";

export default async function DomainsAdmin() {
  await adminPage("domains.manage");
  const [s, adminDomains, userDomains, cf] = await Promise.all([
    getSettings(), db.domain.findMany({ where: { userId: null }, orderBy: { domain: "asc" }, include: { _count: { select: { links: true, bioPages: true } } } }),
    db.domain.findMany({ where: { userId: { not: null } }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, username: true } }, _count: { select: { links: true, bioPages: true } } } }),
    cloudflareConfig(),
  ]);
  return (
    <div>
      <PageHeader title="Domains" description={`Main application host: ${appHost()}. Point additional domains (A/CNAME) to this server and add them below.`} />
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Add domains" description="One per line. They become public (selectable by all users).">
          <ActionForm action={addAdminDomains} submitLabel="Add domains">
            <Textarea name="domains" placeholder={"short.example.com\nlnk.example.org"} required />
            <Input label="Root redirect" name="rootRedirect" placeholder="https://… (where the domain root goes)" />
            <Input label="404 redirect" name="notFoundRedirect" placeholder="URL for unknown aliases" />
          </ActionForm>
        </Card>
        <Card title="Domain settings">
          <ActionForm action={saveDomainSettings} submitLabel="Save settings">
            <SwitchField name="domains.custom" label="Allow user custom domains" defaultChecked={s["domains.custom"] === "1"} />
            <SwitchField name="domains.mainUsable" label="Main domain usable by users" hint="If off, users must pick a custom/public domain" defaultChecked={s["domains.mainUsable"] === "1"} />
            <SwitchField name="domains.verifyDns" label="Verify DNS before activation" defaultChecked={s["domains.verifyDns"] === "1"} />
            <Input label="Default root redirect" name="domains.rootRedirect" defaultValue={s["domains.rootRedirect"]} />
          </ActionForm>
        </Card>
        <Card title="DNS instructions">
          <p className="text-sm text-muted">Create an <strong>A</strong> record pointing to this server's IP, or a <strong>CNAME</strong> pointing to <code>{appHost()}</code>. Then add the domain here (or the user adds it in their dashboard) and approve it.</p>
          <p className="text-sm text-muted mt-2">{userDomains.filter((d) => d.status !== 1).length} user domains await approval.</p>
          <div className="mt-4 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium flex items-center justify-between">Cloudflare SaaS SSL {cf.enabled ? <span className="badge-green">enabled</span> : <span className="badge-gray">off</span>}</p>
            <p className="text-xs text-muted mt-1">{cf.enabled ? `Custom hostnames are provisioned automatically. CNAME target: ${cf.fallbackOrigin || appHost()}.` : "Issue HTTPS certificates for user domains automatically via Cloudflare for SaaS."}</p>
            <Link href="/admin/cloudflare" className="btn-secondary btn-sm mt-2">Configure</Link>
          </div>
        </Card>
      </div>
      <h2 className="font-semibold mb-2">Public domains</h2>
      <Table count={adminDomains.length} head={["Domain", "Redirects", "Usage", "Status", ""]}>
        {adminDomains.map((d) => (
          <tr key={d.id}>
            <td><span className="font-medium">{d.domain}</span> {d.isMain && <span className="badge-blue">main</span>}</td>
            <td>
              <ActionForm action={updateDomain} hidden={{ id: d.id }} submitLabel="Save" className="space-y-1">
                <div className="flex gap-2 flex-wrap"><input name="rootRedirect" className="input w-48" defaultValue={d.rootRedirect ?? ""} placeholder="Root redirect" /><input name="notFoundRedirect" className="input w-48" defaultValue={d.notFoundRedirect ?? ""} placeholder="404 redirect" />
                <SwitchField name="isPublic" label="Public" defaultChecked={d.isPublic} /><SwitchField name="active" label="Active" defaultChecked={d.status === 1} /></div>
              </ActionForm>
            </td>
            <td>{d._count.links} links · {d._count.bioPages} bio</td>
            <td><StatusBadge value={d.status === 1 ? "active" : "pending"} /></td>
            <td className="whitespace-nowrap space-x-1">
              {!d.isMain && <ActionButton action={domainQuick} hidden={{ id: d.id, op: "main" }} showMessage={false}>Set main</ActionButton>}
              <ActionButton action={domainQuick} hidden={{ id: d.id, op: "delete" }} variant="danger" confirm="Delete domain? Links on it will lose their domain." showMessage={false}>Delete</ActionButton>
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="font-semibold mb-2 mt-8">User domains</h2>
      <Table count={userDomains.length} head={["Domain", "User", "Usage", "Status", "Added", "Assign", ""]}>
        {userDomains.map((d) => (
          <tr key={d.id}>
            <td className="font-medium">{d.domain}{d.verifyToken && <span className="block text-xs text-muted font-mono">TXT: {d.verifyToken}</span>}</td>
            <td>{d.user && <Link href={`/admin/users/${d.user.id}`}>{d.user.username}</Link>}</td>
            <td>{d._count.links} links · {d._count.bioPages} bio</td>
            <td><StatusBadge value={d.status === 1 ? "active" : "pending"} /></td>
            <td className="text-muted">{formatDate(d.createdAt)}</td>
            <td><ActionForm action={domainQuick} hidden={{ id: d.id, op: "assign" }} submitLabel="Assign" className="flex items-center gap-1"><input name="user" className="input w-36" placeholder="username (blank = public)" /></ActionForm></td>
            <td className="whitespace-nowrap space-x-1">
              {d.status !== 1 && <ActionButton action={domainQuick} hidden={{ id: d.id, op: "approve" }} variant="primary" showMessage={false}>Approve</ActionButton>}
              <ActionButton action={domainQuick} hidden={{ id: d.id, op: "delete" }} variant="danger" confirm="Delete this domain?" showMessage={false}>Delete</ActionButton>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
