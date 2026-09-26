import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, toDateInput, type SP } from "@/lib/admin/query";
import { formatDate, formatMoney } from "@/lib/utils";
import { shortUrl } from "@/lib/links";
import { Card, Input, PageHeader, Select, Stat } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, UploadField } from "@/components/admin/fields";
import { LinkTabs } from "@/components/admin/link-tabs";
import { Table, StatusBadge } from "@/components/admin/table";
import { updateUser, userQuick } from "../actions";

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await adminPage("users.view");
  const { id } = await params;
  const tab = qs(await searchParams, "tab", "profile");
  const user = await db.user.findUnique({ where: { id }, include: { plan: true, roleRel: true, _count: { select: { links: true, bioPages: true, qrCodes: true, payments: true, referrals: true } } } });
  if (!user) notFound();
  const [plans, roles, languages] = await Promise.all([db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.role.findMany(), db.language.findMany({ where: { active: true } })]);
  const base = `/admin/users/${id}`;
  const tabs = [
    { key: "profile", label: "Profile", href: base }, { key: "links", label: `Links (${user._count.links})`, href: `${base}?tab=links` },
    { key: "bio", label: `Bio pages (${user._count.bioPages})`, href: `${base}?tab=bio` }, { key: "qr", label: `QR codes (${user._count.qrCodes})`, href: `${base}?tab=qr` },
    { key: "payments", label: `Payments (${user._count.payments})`, href: `${base}?tab=payments` }, { key: "activity", label: "Activity", href: `${base}?tab=activity` },
  ];
  const roleValue = user.roleId ? `role:${user.roleId}` : user.role;
  return (
    <div>
      <PageHeader title={<>{user.username} {user.verified && <span className="badge-blue align-middle">Verified</span>}</>} description={user.email}
        actions={<>
          <ActionButton action={userQuick} hidden={{ id, op: "loginAs" }} confirm="Log in as this user? You will be logged out of the admin session.">Login as user</ActionButton>
          {user.status === 0 ? <ActionButton action={userQuick} hidden={{ id, op: "unban" }}>Unban</ActionButton> : <ActionButton action={userQuick} hidden={{ id, op: "ban" }} confirm="Ban this user?">Ban</ActionButton>}
          <ActionButton action={userQuick} hidden={{ id, op: "delete" }} variant="danger" confirm="Delete this user and ALL their links, pages, payments? This cannot be undone.">Delete</ActionButton>
        </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Plan" value={user.plan?.name ?? "-"} sub={user.planExpires ? `expires ${formatDate(user.planExpires)}` : "no expiry"} />
        <Stat label="Status" value={<StatusBadge value={user.status === 1 ? "active" : user.status === 0 ? "banned" : "pending"} />} sub={user.emailVerified ? "email verified" : "email not verified"} />
        <Stat label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt, true) : "-"} sub={user.lastLoginIp ?? ""} />
        <Stat label="Joined" value={formatDate(user.createdAt)} sub={`${user._count.referrals} referrals`} />
      </div>
      <LinkTabs tabs={tabs} active={tab} />
      {tab === "profile" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" title="Account">
            <ActionForm action={updateUser} hidden={{ id }} submitLabel="Save changes">
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Username" name="username" defaultValue={user.username} required />
                <Input label="Email" name="email" type="email" defaultValue={user.email} required />
                <Input label="Name" name="name" defaultValue={user.name ?? ""} />
                <Input label="New password" name="password" type="text" hint="Leave blank to keep current" />
                <Select label="Plan" name="planId" defaultValue={user.planId ?? ""}><option value="">None</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Input label="Plan expires" name="planExpires" type="date" defaultValue={toDateInput(user.planExpires)} />
                <Input label="Trial ends" name="planTrialEnds" type="date" defaultValue={toDateInput(user.planTrialEnds)} />
                <Select label="Status" name="status" defaultValue={String(user.status)}><option value="1">Active</option><option value="0">Banned</option><option value="2">Pending verification</option></Select>
                <Select label="Role" name="role" defaultValue={roleValue}><option value="user">User</option><option value="admin">Administrator</option>{roles.map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name} (custom role)</option>)}</Select>
                <Select label="Language" name="language" defaultValue={user.language}>{languages.length ? languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>) : <option value="en">English</option>}</Select>
                <Input label="Timezone" name="timezone" defaultValue={user.timezone} />
                <Input label="Post-login redirect" name="postLoginRedirect" defaultValue={user.postLoginRedirect ?? ""} placeholder="/dashboard" />
                <Input label="AI credits used" name="aiCredits" type="number" defaultValue={user.aiCredits} />
                <Input label="Affiliate balance" name="affiliateBalance" type="number" step="0.01" defaultValue={user.affiliateBalance} />
              </div>
              <UploadField name="avatar" label="Avatar" defaultValue={user.avatar ?? ""} folder="avatars" />
              <div className="grid md:grid-cols-2 gap-3">
                <SwitchField name="verified" label="Verified badge" defaultChecked={user.verified} />
                <SwitchField name="isPublic" label="Public account" defaultChecked={user.isPublic} />
                <SwitchField name="notifyEmail" label="Email notifications" defaultChecked={user.notifyEmail} />
                {!user.emailVerified && <SwitchField name="verifyEmail" label="Mark email as verified" />}
                {user.twoFactorEnabled && <SwitchField name="disable2fa" label="Disable two-factor auth" />}
              </div>
            </ActionForm>
          </Card>
          <div className="space-y-4">
            <Card title="Quick actions">
              <div className="flex flex-col gap-2 items-start">
                <ActionButton action={userQuick} hidden={{ id, op: "verifyBadge" }}>{user.verified ? "Remove verified badge" : "Grant verified badge"}</ActionButton>
                <ActionButton action={userQuick} hidden={{ id, op: "resendVerification" }}>Resend verification email</ActionButton>
                <ActionButton action={userQuick} hidden={{ id, op: "resetPassword" }}>Send password reset</ActionButton>
                <ActionButton action={userQuick} hidden={{ id, op: "resetAi" }}>Reset AI credits</ActionButton>
                <ActionButton action={userQuick} hidden={{ id, op: "regenerateApiKey" }} confirm="Regenerate the API key?">Regenerate API key</ActionButton>
              </div>
              <p className="hint mt-3">Login as user creates a 5-minute one-time token and opens <code>/login?token=…</code>; the login page exchanges it for a session.</p>
            </Card>
            <Card title="Details">
              <dl className="text-sm grid grid-cols-2 gap-y-1">
                <dt className="text-muted">API key</dt><dd className="truncate font-mono text-xs">{user.apiKey ?? "-"}</dd>
                <dt className="text-muted">Affiliate code</dt><dd>{user.affiliateCode ?? "-"}</dd>
                <dt className="text-muted">2FA</dt><dd>{user.twoFactorEnabled ? `on (${user.twoFactorMethod})` : "off"}</dd>
                <dt className="text-muted">Storage used</dt><dd>{Math.round(user.storageUsed / 1024)} KB</dd>
                <dt className="text-muted">Referred by</dt><dd>{user.referredById ? <Link href={`/admin/users/${user.referredById}`} className="text-primary">view</Link> : "-"}</dd>
              </dl>
            </Card>
          </div>
        </div>
      )}
      {tab === "links" && <UserLinks userId={id} />}
      {tab === "bio" && <UserBio userId={id} />}
      {tab === "qr" && <UserQr userId={id} />}
      {tab === "payments" && <UserPayments userId={id} />}
      {tab === "activity" && <UserActivity userId={id} />}
    </div>
  );
}

async function UserLinks({ userId }: { userId: string }) {
  const links = await db.link.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, include: { domain: true } });
  return <Table count={links.length} head={["Short", "URL", "Clicks", "Status", "Created", ""]}>
    {links.map((l) => <tr key={l.id}><td><a href={shortUrl(l)} target="_blank" className="text-primary">{l.domain?.domain ?? ""}/{l.alias}</a></td><td className="max-w-xs truncate text-muted">{l.url}</td><td>{l.clicks}</td><td><StatusBadge value={l.status} /></td><td>{formatDate(l.createdAt)}</td><td><Link href={`/admin/links/${l.id}`} className="btn-secondary btn-sm">Open</Link></td></tr>)}
  </Table>;
}
async function UserBio({ userId }: { userId: string }) {
  const pages = await db.bioPage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return <Table count={pages.length} head={["Alias", "Name", "Views", "Status", "Created"]}>
    {pages.map((b) => <tr key={b.id}><td><a href={`/${b.alias}`} target="_blank" className="text-primary">/{b.alias}</a></td><td>{b.name ?? "-"}</td><td>{b.views}</td><td><StatusBadge value={b.status} /></td><td>{formatDate(b.createdAt)}</td></tr>)}
  </Table>;
}
async function UserQr({ userId }: { userId: string }) {
  const qrs = await db.qrCode.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return <Table count={qrs.length} head={["Name", "Type", "Scans", "Created"]}>
    {qrs.map((q) => <tr key={q.id}><td>{q.name}</td><td>{q.type}</td><td>{q.scans}</td><td>{formatDate(q.createdAt)}</td></tr>)}
  </Table>;
}
async function UserPayments({ userId }: { userId: string }) {
  const payments = await db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, include: { plan: true } });
  return <Table count={payments.length} head={["Invoice", "Plan", "Gateway", "Amount", "Status", "Date", ""]}>
    {payments.map((p) => <tr key={p.id}><td>{p.invoiceNumber ?? p.id.slice(0, 8)}</td><td>{p.plan?.name ?? "-"} ({p.interval})</td><td>{p.gateway}</td><td>{formatMoney(p.amount, p.currency)}</td><td><StatusBadge value={p.status} /></td><td>{formatDate(p.createdAt)}</td><td><Link href={`/admin/payments/${p.id}`} className="btn-secondary btn-sm">View</Link></td></tr>)}
  </Table>;
}
async function UserActivity({ userId }: { userId: string }) {
  const rows = await db.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return <Table count={rows.length} head={["Date", "IP", "Country", "Agent", "Result"]}>
    {rows.map((r) => <tr key={r.id}><td>{formatDate(r.createdAt, true)}</td><td>{r.ip ?? "-"}</td><td>{r.country ?? "-"}</td><td className="max-w-xs truncate text-muted">{r.userAgent ?? "-"}</td><td><StatusBadge value={r.success ? "active" : "failed"} /></td></tr>)}
  </Table>;
}
