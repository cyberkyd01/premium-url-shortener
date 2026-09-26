"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSetting } from "@/lib/settings";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { sendTemplate } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { TEAM_PERMISSIONS, type TeamPermissions } from "@/lib/permissions";
import { appUrl, randomToken } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/teams";
const ROLES = ["admin", "member", "viewer"] as const;
type Role = (typeof ROLES)[number];

/** Switch the active workspace (own account or a team the user belongs to). */
export async function switchTeam(teamId: string | null) {
  const u = await requireUser();
  if (teamId) {
    const m = await db.teamMember.findFirst({ where: { userId: u.id, teamId } });
    if (!m) return;
  }
  await db.user.update({ where: { id: u.id }, data: { activeTeamId: teamId } });
  revalidatePath("/dashboard");
}

async function teamsAllowed(userId: string) {
  if ((await getSetting("teams.enabled")) !== "1") return { ok: false as const, error: "Teams are disabled" };
  const { user, features } = await getUserPlan(userId);
  if (user.role !== "admin" && !features.teams) return { ok: false as const, error: "Your plan does not include teams" };
  return { ok: true as const };
}

/** Owner or a member with team.manage may administer the team. */
async function canManage(userId: string, teamId: string) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return null;
  if (team.ownerId === userId) return { team, owner: true };
  const m = await db.teamMember.findFirst({ where: { teamId, userId } });
  if (m && (m.role === "admin" || (JSON.parse(m.permissions || "{}") as TeamPermissions).team?.includes("manage"))) return { team, owner: false };
  return null;
}

/** Parses the permissions checkbox matrix: inputs named `perm:<module>:<action>`. */
function parsePermissions(fd: FormData, role: Role): TeamPermissions {
  const out: TeamPermissions = {};
  for (const [module, actions] of Object.entries(TEAM_PERMISSIONS)) {
    const chosen = actions.filter((a) => fd.get(`perm:${module}:${a}`) === "on");
    if (role === "viewer") { const v = actions.filter((a) => a === "view" || a === "stats"); if (v.length) out[module as keyof typeof TEAM_PERMISSIONS] = [...v]; continue; }
    if (role === "admin") { out[module as keyof typeof TEAM_PERMISSIONS] = ["*"]; continue; }
    if (chosen.length) out[module as keyof typeof TEAM_PERMISSIONS] = chosen;
  }
  return out;
}

export async function createTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const allowed = await teamsAllowed(u.id);
  if (!allowed.ok) return { error: allowed.error };
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) return { error: "Team name must be at least 2 characters" };
  const count = await db.team.count({ where: { ownerId: u.id } });
  if (u.role !== "admin" && count >= 5) return { error: "You can own up to 5 teams" };
  await db.team.create({ data: { name, ownerId: u.id } });
  revalidatePath(P);
  return { ok: true, message: "Team created" };
}

export async function renameTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const teamId = String(fd.get("teamId") ?? "");
  const m = await canManage(u.id, teamId);
  if (!m) return { error: "Not allowed" };
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) return { error: "Team name must be at least 2 characters" };
  await db.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath(P);
  return { ok: true, message: "Team renamed" };
}

export async function deleteTeam(fd: FormData) {
  const u = await requireUser();
  const teamId = String(fd.get("teamId") ?? "");
  const team = await db.team.findFirst({ where: { id: teamId, ownerId: u.id } });
  if (!team) return;
  await db.user.updateMany({ where: { activeTeamId: teamId }, data: { activeTeamId: null } });
  await db.team.delete({ where: { id: teamId } });
  revalidatePath("/dashboard");
}

export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const teamId = String(fd.get("teamId") ?? "");
  const m = await canManage(u.id, teamId);
  if (!m) return { error: "Not allowed" };
  const allowed = await teamsAllowed(m.team.ownerId);
  if (!allowed.ok) return { error: allowed.error };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email" };
  const roleRaw = String(fd.get("role") ?? "member");
  const role: Role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : "member";
  const owner = await db.user.findUnique({ where: { id: m.team.ownerId } });
  if (owner?.email === email) return { error: "The owner is already part of the team" };
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser && (await db.teamMember.findFirst({ where: { teamId, userId: existingUser.id } }))) return { error: "This user is already a member" };
  if (await db.teamInvite.findFirst({ where: { teamId, email, accepted: false, expiresAt: { gt: new Date() } } })) return { error: "An invitation is already pending for this email" };
  const lim = await withinLimit(m.team.ownerId, "limitTeamMembers");
  const pendingCount = await db.teamInvite.count({ where: { team: { ownerId: m.team.ownerId }, accepted: false, expiresAt: { gt: new Date() } } });
  if (!lim.ok || (lim.limit !== -1 && lim.used + pendingCount >= lim.limit)) return { error: `Your plan allows ${lim.limit} team members (including pending invitations)` };
  const permissions = parsePermissions(fd, role);
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await db.teamInvite.create({ data: { teamId, email, token, role, permissions: JSON.stringify(permissions), inviterId: u.id, expiresAt } });
  await sendTemplate("team-invite", email, { inviter: u.name || u.username, team: m.team.name, link: appUrl("/invite/" + token) }, existingUser?.language ?? "en");
  if (existingUser) await notify(existingUser.id, "Team invitation", `${u.username} invited you to join ${m.team.name}.`, { link: "/invite/" + token }).catch(() => {});
  revalidatePath(P);
  return { ok: true, message: `Invitation sent to ${email}` };
}

export async function resendInvite(fd: FormData) {
  const u = await requireUser();
  const inv = await db.teamInvite.findUnique({ where: { id: String(fd.get("id") ?? "") }, include: { team: true } });
  if (!inv || inv.accepted || !(await canManage(u.id, inv.teamId))) return;
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await db.teamInvite.update({ where: { id: inv.id }, data: { expiresAt } });
  await sendTemplate("team-invite", inv.email, { inviter: u.name || u.username, team: inv.team.name, link: appUrl("/invite/" + inv.token) });
  revalidatePath(P);
}

export async function cancelInvite(fd: FormData) {
  const u = await requireUser();
  const inv = await db.teamInvite.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!inv || !(await canManage(u.id, inv.teamId))) return;
  await db.teamInvite.delete({ where: { id: inv.id } });
  revalidatePath(P);
}

export async function updateMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const member = await db.teamMember.findUnique({ where: { id: String(fd.get("memberId") ?? "") } });
  if (!member) return { error: "Member not found" };
  const m = await canManage(u.id, member.teamId);
  if (!m) return { error: "Not allowed" };
  if (member.userId === u.id && !m.owner) return { error: "You cannot change your own permissions" };
  const roleRaw = String(fd.get("role") ?? member.role);
  const role: Role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : "member";
  await db.teamMember.update({ where: { id: member.id }, data: { role, permissions: JSON.stringify(parsePermissions(fd, role)) } });
  revalidatePath(P);
  return { ok: true, message: "Member updated" };
}

export async function removeMember(fd: FormData) {
  const u = await requireUser();
  const member = await db.teamMember.findUnique({ where: { id: String(fd.get("memberId") ?? "") } });
  if (!member || !(await canManage(u.id, member.teamId))) return;
  await db.teamMember.delete({ where: { id: member.id } });
  await db.user.updateMany({ where: { id: member.userId, activeTeamId: member.teamId }, data: { activeTeamId: null } });
  revalidatePath("/dashboard");
}

export async function leaveTeam(fd: FormData) {
  const u = await requireUser();
  const teamId = String(fd.get("teamId") ?? "");
  await db.teamMember.deleteMany({ where: { teamId, userId: u.id } });
  await db.user.updateMany({ where: { id: u.id, activeTeamId: teamId }, data: { activeTeamId: null } });
  revalidatePath("/dashboard");
}
