import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { Alert, Card, PageHeader } from "@/components/ui";
import { CreateTeamForm, ManagedTeam, MembershipRow } from "./team-forms";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  const { user, plan, features } = await getUserPlan(ws.userId);
  const enabled = s["teams.enabled"] === "1";
  const allowed = user.role === "admin" || features.teams;
  const [owned, memberships, managed] = await Promise.all([
    db.team.findMany({ where: { ownerId: ws.userId }, include: { members: { include: { user: { select: { id: true, username: true, email: true, name: true } } } }, invites: { where: { accepted: false }, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "asc" } }),
    db.teamMember.findMany({ where: { userId: ws.userId }, include: { team: { include: { owner: { select: { username: true } } } } } }),
    db.teamMember.findMany({ where: { userId: ws.userId, role: "admin" }, include: { team: { include: { members: { include: { user: { select: { id: true, username: true, email: true, name: true } } } }, invites: { where: { accepted: false }, orderBy: { createdAt: "desc" } } } } } }),
  ]);
  const limit = user.role === "admin" ? -1 : plan?.limitTeamMembers ?? 0;
  const serialize = (t: (typeof owned)[number]) => ({
    team: { id: t.id, name: t.name },
    members: t.members.map((m) => ({ id: m.id, role: m.role, permissions: m.permissions, user: m.user })),
    invites: t.invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() })),
  });
  return (
    <div>
      <PageHeader title="Teams" description="Collaborate on links, bio pages and campaigns with your team." />
      {!enabled ? <Alert type="info">Teams are disabled by the administrator.</Alert> : !allowed ? <Alert type="warning">Your plan does not include teams. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to create a team.</Alert> : (
        <div className="space-y-6">
          {limit === 0 && <Alert type="warning">Your plan does not include any team member seats. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to invite members.</Alert>}
          <Card title="Your teams" description="Teams you own. Switch between workspaces from the top bar."><CreateTeamForm /></Card>
          {owned.map((t) => <ManagedTeam key={t.id} {...serialize(t)} isOwner currentUserId={ws.userId} limit={limit} />)}
          {managed.map((m) => <ManagedTeam key={m.id} {...serialize(m.team)} isOwner={false} currentUserId={ws.userId} limit={-1} />)}
        </div>
      )}
      {memberships.length > 0 && (
        <Card title="Team memberships" description="Teams you belong to." className="mt-6">
          <ul className="divide-y divide-border">{memberships.map((m) => <MembershipRow key={m.id} membership={{ id: m.id, role: m.role, teamId: m.teamId, team: { name: m.team.name, owner: m.team.owner } }} />)}</ul>
        </Card>
      )}
    </div>
  );
}
