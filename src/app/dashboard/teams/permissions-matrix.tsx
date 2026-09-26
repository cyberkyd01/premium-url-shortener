"use client";
import { useState } from "react";
import { TEAM_PERMISSIONS, type TeamPermissions } from "@/lib/permissions";
import { Select } from "@/components/ui";

const LABELS: Record<string, string> = { links: "Links", bio: "Bio pages", qr: "QR codes", campaigns: "Campaigns", pixels: "Pixels", domains: "Domains", splash: "Splash pages", overlays: "Overlays", team: "Team" };

/** Role select + per-module permission checkbox matrix. Inputs: `role`, `perm:<module>:<action>`. */
export function PermissionsMatrix({ role: initialRole = "member", permissions = {} }: { role?: string; permissions?: TeamPermissions }) {
  const [role, setRole] = useState(initialRole);
  const disabled = role !== "member";
  return (
    <div className="space-y-3">
      <Select label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value)} hint={role === "admin" ? "Admins have full access to every module." : role === "viewer" ? "Viewers can only view resources and statistics." : "Pick what this member may do in each module."}>
        <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
      </Select>
      <div className={"overflow-x-auto rounded-lg border border-border " + (disabled ? "opacity-50 pointer-events-none" : "")}>
        <table className="table text-xs">
          <thead><tr><th>Module</th>{["view", "create", "edit", "delete", "stats", "manage"].map((a) => <th key={a} className="text-center capitalize">{a}</th>)}</tr></thead>
          <tbody>
            {Object.entries(TEAM_PERMISSIONS).map(([module, actions]) => {
              const current = permissions[module as keyof typeof TEAM_PERMISSIONS] ?? [];
              return (
                <tr key={module}>
                  <td className="font-medium">{LABELS[module] ?? module}</td>
                  {["view", "create", "edit", "delete", "stats", "manage"].map((a) => (
                    <td key={a} className="text-center">{(actions as readonly string[]).includes(a) ? <input type="checkbox" name={`perm:${module}:${a}`} defaultChecked={current.includes("*") || current.includes(a) || (module !== "team" && a === "view" && current.length === 0)} /> : <span className="text-muted">-</span>}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
