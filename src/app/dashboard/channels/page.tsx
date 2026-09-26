import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { PageHeader, Card, Empty, Badge, Alert, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { ChannelFormButton } from "./channel-form";
import { deleteChannel, toggleStar } from "./actions";
import { Star, Trash2, Link2, QrCode, UserCircle } from "lucide-react";

export const metadata = { title: "Channels" };

export default async function ChannelsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [{ plan, user }, channels] = await Promise.all([
    getUserPlan(ws.ownerId),
    db.channel.findMany({ where: { userId: ws.ownerId }, orderBy: [{ starred: "desc" }, { name: "asc" }], include: { _count: { select: { links: true, qrCodes: true, bioPages: true } } } }),
  ]);
  const limit = user.role === "admin" ? -1 : plan?.limitChannels ?? -1;
  const atLimit = limit !== -1 && channels.length >= limit;
  const canCreate = can(ws, "campaigns", "create");
  const canEdit = can(ws, "campaigns", "edit");
  const canDelete = can(ws, "campaigns", "delete");
  return (
    <div>
      <PageHeader title="Channels" description="Organize your links, QR codes and bio pages into channels. Starred channels are pinned in the sidebar."
        actions={<>{limit !== -1 && <span className="text-sm text-muted">{channels.length} / {limit} used</span>}{canCreate && <ChannelFormButton disabled={atLimit} disabledHint="Channel limit reached" />}</>} />
      {atLimit && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit} channels on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to create more.</Alert></div>}
      <Card>
        {channels.length === 0 ? (
          <Empty title="No channels yet" description="Create a channel to group related links, QR codes and bio pages." action={canCreate && !atLimit ? <ChannelFormButton /> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Channel</th><th>Links</th><th>QR codes</th><th>Bio pages</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/dashboard/channels/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.color }} />{c.name}
                        {c.starred && <Badge color="yellow">Starred</Badge>}
                      </Link>
                    </td>
                    <td><span className="inline-flex items-center gap-1 text-muted"><Link2 size={14} />{c._count.links}</span></td>
                    <td><span className="inline-flex items-center gap-1 text-muted"><QrCode size={14} />{c._count.qrCodes}</span></td>
                    <td><span className="inline-flex items-center gap-1 text-muted"><UserCircle size={14} />{c._count.bioPages}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <form action={toggleStar}><input type="hidden" name="id" value={c.id} /><Button type="submit" variant="ghost" size="sm" title={c.starred ? "Unstar" : "Star"}><Star size={14} className={c.starred ? "fill-warning text-warning" : ""} /></Button></form>
                        )}
                        {canEdit && <ChannelFormButton channel={{ id: c.id, name: c.name, color: c.color, starred: c.starred }} />}
                        {canDelete && (
                          <ConfirmForm action={deleteChannel} hidden={{ id: c.id }} message={`Delete "${c.name}"? Items in this channel will be unassigned but not deleted.`}>
                            <Button type="submit" variant="ghost" size="sm" className="text-danger" title="Delete"><Trash2 size={14} /></Button>
                          </ConfirmForm>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
