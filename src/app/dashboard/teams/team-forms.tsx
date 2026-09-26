"use client";
import { useActionState, useState } from "react";
import { Card, Input, Button, Modal, Badge } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import type { TeamPermissions } from "@/lib/permissions";
import { PermissionsMatrix } from "./permissions-matrix";
import { createTeam, renameTeam, deleteTeam, inviteMember, resendInvite, cancelInvite, updateMember, removeMember, leaveTeam } from "./actions";

export function CreateTeamForm() {
  const [state, action] = useActionState(createTeam, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Input label="New team" name="name" placeholder="Marketing team" required className="flex-1 min-w-48" />
      <SubmitButton>Create team</SubmitButton>
      <div className="basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

export type TeamMemberRow = { id: string; role: string; permissions: string; user: { id: string; username: string; email: string; name: string | null } };
export type InviteRow = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

function parsePerms(s: string): TeamPermissions { try { return JSON.parse(s) as TeamPermissions; } catch { return {}; } }

export function ManagedTeam({ team, members, invites, isOwner, currentUserId, limit }: { team: { id: string; name: string }; members: TeamMemberRow[]; invites: InviteRow[]; isOwner: boolean; currentUserId: string; limit: number }) {
  const [inviteState, inviteAction] = useActionState(inviteMember, null);
  const [renameState, renameAction] = useActionState(renameTeam, null);
  const [editState, editAction] = useActionState(updateMember, null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const seats = members.length + invites.length;
  return (
    <Card title={<span className="flex items-center gap-2">{team.name}{isOwner ? <Badge color="blue">Owner</Badge> : <Badge color="gray">Manager</Badge>}</span>} description={`${members.length} member${members.length === 1 ? "" : "s"}${limit === -1 ? "" : ` · ${seats}/${limit} seats used`}`}
      actions={<>
        <Button type="button" size="sm" onClick={() => setInviteOpen(true)} disabled={limit !== -1 && seats >= limit}>Invite member</Button>
        {isOwner && <ConfirmForm action={deleteTeam} hidden={{ teamId: team.id }} message="Delete this team? Members will lose access."><Button type="submit" variant="danger" size="sm">Delete</Button></ConfirmForm>}
      </>}>
      <div className="space-y-5">
        <form action={renameAction} className="flex items-end gap-2">
          <input type="hidden" name="teamId" value={team.id} />
          <Input label="Team name" name="name" defaultValue={team.name} className="flex-1 max-w-sm" />
          <SubmitButton variant="secondary" size="sm">Rename</SubmitButton>
          <FormMessage state={renameState} />
        </form>
        <div>
          <h4 className="text-sm font-semibold mb-2">Members</h4>
          {members.length === 0 ? <p className="text-sm text-muted">No members yet. Invite someone to collaborate.</p> : (
            <div className="overflow-x-auto -mx-5"><table className="table">
              <thead><tr><th>User</th><th>Role</th><th>Permissions</th><th></th></tr></thead>
              <tbody>{members.map((m) => { const p = parsePerms(m.permissions); const modules = Object.entries(p).filter(([, v]) => v && v.length).map(([k, v]) => `${k}: ${v!.includes("*") ? "all" : v!.join("/")}`); return (
                <tr key={m.id}>
                  <td><p className="font-medium">{m.user.name ?? m.user.username}</p><p className="text-xs text-muted">{m.user.email}</p></td>
                  <td><Badge color={m.role === "admin" ? "blue" : m.role === "viewer" ? "gray" : "green"}>{m.role}</Badge></td>
                  <td className="text-xs text-muted max-w-64 truncate" title={modules.join(", ")}>{m.role === "admin" ? "Full access" : modules.join(", ") || "None"}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(m)} disabled={m.user.id === currentUserId && !isOwner}>Edit</Button>
                    <ConfirmForm action={removeMember} hidden={{ memberId: m.id }} message="Remove this member from the team?" className="inline"><Button type="submit" variant="ghost" size="sm" className="text-danger">Remove</Button></ConfirmForm>
                  </td>
                </tr>
              ); })}</tbody>
            </table></div>
          )}
        </div>
        {invites.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Pending invitations</h4>
            <div className="overflow-x-auto -mx-5"><table className="table">
              <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th></th></tr></thead>
              <tbody>{invites.map((i) => { const expired = new Date(i.expiresAt) < new Date(); return (
                <tr key={i.id}>
                  <td>{i.email}</td><td><Badge color="gray">{i.role}</Badge></td>
                  <td>{expired ? <Badge color="red">Expired</Badge> : new Date(i.expiresAt).toLocaleDateString()}</td>
                  <td className="text-right whitespace-nowrap">
                    <form action={resendInvite} className="inline"><input type="hidden" name="id" value={i.id} /><Button type="submit" variant="ghost" size="sm">Resend</Button></form>
                    <form action={cancelInvite} className="inline"><input type="hidden" name="id" value={i.id} /><Button type="submit" variant="ghost" size="sm" className="text-danger">Cancel</Button></form>
                  </td>
                </tr>
              ); })}</tbody>
            </table></div>
          </div>
        )}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={`Invite to ${team.name}`} wide>
        <form action={inviteAction} className="space-y-4">
          <input type="hidden" name="teamId" value={team.id} />
          <Input label="Email address" name="email" type="email" required placeholder="colleague@company.com" />
          <PermissionsMatrix />
          <FormMessage state={inviteState} />
          <p className="hint">The invitation link is valid for 7 days.</p>
          <SubmitButton>Send invitation</SubmitButton>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.user.username}` : ""} wide>
        {editing && (
          <form action={editAction} className="space-y-4">
            <input type="hidden" name="memberId" value={editing.id} />
            <PermissionsMatrix role={editing.role} permissions={parsePerms(editing.permissions)} />
            <FormMessage state={editState} />
            <SubmitButton>Save</SubmitButton>
          </form>
        )}
      </Modal>
    </Card>
  );
}

export function MembershipRow({ membership }: { membership: { id: string; role: string; teamId: string; team: { name: string; owner: { username: string } } } }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div><p className="font-medium">{membership.team.name}</p><p className="text-xs text-muted">Owned by {membership.team.owner.username} · role {membership.role}</p></div>
      <ConfirmForm action={leaveTeam} hidden={{ teamId: membership.teamId }} message="Leave this team?"><Button type="submit" variant="secondary" size="sm">Leave</Button></ConfirmForm>
    </li>
  );
}
