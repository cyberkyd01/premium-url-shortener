import { db } from "./db";
import { currentUser } from "./auth";
import { teamAllows, type TeamPermissions } from "./permissions";
import { json } from "./utils";

/** Resolves the effective workspace: the user's own account or the team they switched into.
 *  `ownerId` is the id whose resources (links, bio pages, ...) are shown/created. */
export async function getWorkspace() {
  const u = await currentUser();
  if (!u) return null;
  const user = await db.user.findUnique({ where: { id: u.id }, select: { activeTeamId: true, role: true } });
  if (user?.activeTeamId) {
    const m = await db.teamMember.findFirst({ where: { userId: u.id, teamId: user.activeTeamId }, include: { team: true } });
    if (m) return { userId: u.id, ownerId: m.team.ownerId, teamId: m.teamId, teamName: m.team.name, isTeam: true, isAdmin: u.role === "admin", perms: json<TeamPermissions>(m.permissions, {}), teamRole: m.role };
  }
  return { userId: u.id, ownerId: u.id, teamId: null, teamName: null, isTeam: false, isAdmin: u.role === "admin", perms: null as TeamPermissions | null, teamRole: "owner" };
}

export type Workspace = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;

export function can(ws: Workspace, module: Parameters<typeof teamAllows>[1], action: string) {
  if (!ws.isTeam) return true;
  if (ws.teamRole === "admin") return true;
  return teamAllows(ws.perms ?? {}, module, action);
}
