"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool, list } from "@/lib/admin/query";
import { slugify } from "@/lib/utils";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import type { ActionState } from "@/components/ui/form-state";

export async function saveRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("roles.manage", async () => {
    const id = optStr(fd, "id");
    const name = str(fd, "name");
    if (!name) return { ok: false, error: "Name is required." };
    const slug = slugify(str(fd, "slug") || name);
    if (!slug || slug === "admin" || slug === "user") return { ok: false, error: "Invalid slug." };
    const valid = new Set<string>(ADMIN_PERMISSIONS.map((p) => p.key));
    const permissions = list(fd, "permissions").filter((p) => valid.has(p));
    const data = { name, slug, description: optStr(fd, "description"), isAdmin: bool(fd, "isAdmin"), permissions: JSON.stringify(permissions) };
    const dup = await db.role.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } });
    if (dup) return { ok: false, error: "A role with this slug already exists." };
    if (id) await db.role.update({ where: { id }, data }); else await db.role.create({ data });
    revalidatePath("/admin/roles");
    return { ok: true, message: "Role saved." };
  });
}

export async function deleteRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("roles.manage", async () => {
    const id = str(fd, "id");
    await db.user.updateMany({ where: { roleId: id }, data: { roleId: null, role: "user" } });
    await db.role.delete({ where: { id } });
    revalidatePath("/admin/roles");
    return { ok: true, message: "Role deleted; its users were downgraded to regular users." };
  });
}
