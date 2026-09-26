import { redirect } from "next/navigation";
import { currentUser, hasAdminPermission } from "@/lib/auth";
import type { AdminPermission } from "@/lib/permissions";
import type { ActionState } from "@/components/ui/form-state";

export type AdminUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** Page guard: must be an admin (role) and hold the given permission (custom roles). */
export async function adminPage(permission: AdminPermission): Promise<AdminUser> {
  const u = await currentUser();
  if (!u || u.role !== "admin") redirect("/login?callbackUrl=/admin");
  if (!(await hasAdminPermission(permission))) redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  return u;
}

/** Throws when the current user is not an admin with the permission (for actions / route handlers). */
export async function requirePermission(permission: AdminPermission): Promise<AdminUser> {
  const u = await currentUser();
  if (!u || u.role !== "admin") throw new Error("You must be logged in as an administrator.");
  if (!(await hasAdminPermission(permission))) throw new Error(`Missing permission: ${permission}`);
  return u;
}

function isNextInternal(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_");
}

/** Wraps a server action body: checks the permission and converts thrown errors into ActionState. */
export async function act(permission: AdminPermission, fn: (admin: AdminUser) => Promise<ActionState>): Promise<ActionState> {
  try {
    const admin = await requirePermission(permission);
    return await fn(admin);
  } catch (e) {
    if (isNextInternal(e)) throw e;
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Route-handler guard: returns the admin or null (caller responds 403). */
export async function apiAdmin(permission: AdminPermission): Promise<AdminUser | null> {
  try {
    return await requirePermission(permission);
  } catch {
    return null;
  }
}
