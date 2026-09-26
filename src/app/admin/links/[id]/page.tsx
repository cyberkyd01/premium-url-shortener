import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getStats, recentClicks } from "@/lib/stats";
import { shortUrl, parseLinkJson } from "@/lib/links";
import { toDateTimeInput } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { Card, CopyButton, Input, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { ClicksChart, BarsChart, TopList, DonutChart } from "@/components/ui/charts";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { StatusBadge, Table } from "@/components/admin/table";
import { adminUpdateLink, linkQuick } from "../actions";

export default async function AdminLinkPage({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("links.view");
  const { id } = await params;
  const link = await db.link.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, email: true } }, domain: true, campaign: true, pixels: { include: { pixel: true } } } });
  if (!link) notFound();
  const [stats, recent] = await Promise.all([getStats({ linkId: id }, 30), recentClicks({ linkId: id }, 25)]);
  const parsed = parseLinkJson(link);
  const short = shortUrl(link);
  return (
    <div>
      <PageHeader title={<span className="font-mono">{short}</span>} description={<a href={link.url} target="_blank" rel="noreferrer" className="text-primary break-all">{link.url}</a>}
        actions={<>
          <CopyButton text={short} />
          {link.status === "pending" && <ActionButton action={linkQuick} hidden={{ id, op: "approve" }} variant="primary">Approve</ActionButton>}
          {link.status === "active" ? <ActionButton action={linkQuick} hidden={{ id, op: "disable" }}>Disable</ActionButton> : <ActionButton action={linkQuick} hidden={{ id, op: "enable" }}>Enable</ActionButton>}
          {link.status !== "blocked" && <ActionButton action={linkQuick} hidden={{ id, op: "block" }} confirm="Block this link?">Block</ActionButton>}
          <ActionButton action={linkQuick} hidden={{ id, op: "delete" }} variant="danger" confirm="Delete this link and its statistics?">Delete</ActionButton>
        </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Total clicks" value={link.clicks} sub={`${link.uniqueClicks} unique`} />
        <Stat label="Last 30 days" value={stats.total} sub={`${stats.unique} unique`} />
        <Stat label="Status" value={<StatusBadge value={link.status} />} sub={link.redirectType} />
        <Stat label="Owner" value={link.user ? <Link href={`/admin/users/${link.user.id}`} className="text-primary">{link.user.username}</Link> : "Anonymous"} sub={`created ${formatDate(link.createdAt)}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Clicks (30 days)" className="lg:col-span-2"><ClicksChart data={stats.byDay} /></Card>
        <Card title="Devices"><DonutChart data={stats.devices} /><TopList data={stats.devices} total={stats.total} /></Card>
        <Card title="Countries"><TopList data={stats.countries} total={stats.total} /></Card>
        <Card title="Referrers"><TopList data={stats.referers} total={stats.total} /></Card>
        <Card title="Browsers & OS"><TopList data={[...stats.browsers.slice(0, 5), ...stats.os.slice(0, 5)]} total={stats.total} /></Card>
        <Card title="Hours" className="lg:col-span-3"><BarsChart data={stats.byHour} xKey="hour" dataKey="clicks" height={180} /></Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Edit link">
          <ActionForm action={adminUpdateLink} hidden={{ id }} submitLabel="Save">
            <Input label="Destination URL" name="url" defaultValue={link.url} required />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Alias" name="alias" defaultValue={link.alias} required />
              <Select label="Status" name="status" defaultValue={link.status}>{["active", "pending", "disabled", "blocked"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
              <Input label="Title" name="title" defaultValue={link.title ?? ""} />
              <Select label="Redirect type" name="redirectType" defaultValue={link.redirectType}>{["direct", "frame", "splash", "custom", "overlay"].map((t) => <option key={t} value={t}>{t}</option>)}</Select>
              <Input label="Expires at" name="expiresAt" type="datetime-local" defaultValue={toDateTimeInput(link.expiresAt)} />
              <Input label="Expired URL" name="expiredUrl" defaultValue={link.expiredUrl ?? ""} />
              <Input label="Click limit" name="clickLimit" type="number" defaultValue={link.clickLimit ?? ""} />
              <Input label="New password" name="password" hint={link.password ? "Password set; leave blank to keep" : "No password"} />
            </div>
            <Textarea label="Description" name="description" defaultValue={link.description ?? ""} />
            <Textarea label="Notes" name="notes" defaultValue={link.notes ?? ""} />
            <SwitchField name="isPublic" label="Public statistics" defaultChecked={link.isPublic} />
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card title="Targeting & options">
            <dl className="text-sm grid grid-cols-2 gap-y-1">
              <dt className="text-muted">Domain</dt><dd>{link.domain?.domain ?? "main"}</dd>
              <dt className="text-muted">Campaign</dt><dd>{link.campaign?.name ?? "-"}</dd>
              <dt className="text-muted">Geo targets</dt><dd>{parsed.geoTargets.length}</dd>
              <dt className="text-muted">Device targets</dt><dd>{parsed.deviceTargets.length}</dd>
              <dt className="text-muted">A/B URLs</dt><dd>{parsed.abUrls.length} ({link.rotatorMode})</dd>
              <dt className="text-muted">Deep link</dt><dd>{link.deepLink ? "yes" : "no"}</dd>
              <dt className="text-muted">Cloaking / bot block</dt><dd>{link.cloaking ? "yes" : "no"} / {link.botBlock ? "yes" : "no"}</dd>
              <dt className="text-muted">Pixels</dt><dd>{link.pixels.map((p) => p.pixel.name).join(", ") || "-"}</dd>
              <dt className="text-muted">UTM</dt><dd className="truncate">{Object.entries(parsed.utm).map(([k, v]) => `${k}=${v}`).join("&") || "-"}</dd>
              <dt className="text-muted">Anonymous / premium alias</dt><dd>{link.isAnonymous ? "yes" : "no"} / {link.isPremiumAlias ? "yes" : "no"}</dd>
            </dl>
          </Card>
          <Card title="Recent clicks">
            <Table count={recent.length} head={["Time", "Country", "Device", "Referrer"]}>
              {recent.map((c) => <tr key={c.id}><td>{formatDate(c.createdAt, true)}</td><td>{c.countryCode ?? "-"} {c.city ?? ""}</td><td>{c.device ?? "-"} · {c.browser ?? ""}</td><td className="truncate max-w-[160px]">{c.refererHost ?? "direct"}</td></tr>)}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
