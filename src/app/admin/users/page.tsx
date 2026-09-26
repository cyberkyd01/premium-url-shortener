import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { Table, StatusBadge, Ids } from "@/components/admin/table";
import { bulkUsers } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function UsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("users.view");
  const sp = await searchParams;
  const q = qs(sp, "q"), role = qs(sp, "role"), planId = qs(sp, "plan"), status = qs(sp, "status");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ username: { contains: q } }, { email: { contains: q } }, { name: { contains: q } }] } : {}),
    ...(role === "admin" ? { role: "admin", roleId: null } : role === "user" ? { role: "user" } : role.startsWith("role:") ? { roleId: role.slice(5) } : {}),
    ...(planId ? { planId } : {}), ...(status !== "" ? { status: parseInt(status, 10) } : {}),
  };
  const [users, total, plans, roles] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { plan: { select: { name: true } }, roleRel: { select: { name: true } }, _count: { select: { links: true } } } }),
    db.user.count({ where }), db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.role.findMany(),
  ]);
  return (
    <div>
      <PageHeader title="Users" description={`${total} users`} actions={<Link href="/admin/users/new" className="btn-primary">Create user</Link>} />
      <FilterBar fields={[
        { name: "q", value: q, placeholder: "Search username, email, name" },
        { name: "role", type: "select", value: role, options: [{ value: "", label: "All roles" }, { value: "admin", label: "Admin" }, { value: "user", label: "User" }, ...roles.map((r) => ({ value: `role:${r.id}`, label: r.name }))] },
        { name: "plan", type: "select", value: planId, options: [{ value: "", label: "All plans" }, ...plans.map((p) => ({ value: p.id, label: p.name }))] },
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, { value: "1", label: "Active" }, { value: "0", label: "Banned" }, { value: "2", label: "Pending" }] },
      ]} />
      <BulkForm action={bulkUsers} options={[{ value: "ban", label: "Ban" }, { value: "activate", label: "Activate" }, { value: "delete", label: "Delete" }, ...plans.map((p) => ({ value: `plan:${p.id}`, label: `Assign plan: ${p.name}` })), { value: "email", label: "Send email" }]}
        extra={<details className="text-sm"><summary className="cursor-pointer text-muted">Email fields</summary><div className="flex gap-2 mt-2"><input name="subject" className="input w-56" placeholder="Subject" /><textarea name="body" className="input w-96" placeholder="HTML message ({{username}} available)" /></div></details>}>
        <Table count={users.length} head={["", "User", "Plan", "Role", "Status", "Links", "Joined", ""]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Ids id={u.id} /></td>
              <td><Link href={`/admin/users/${u.id}`} className="font-medium">{u.username}</Link>{u.verified && <span className="badge-blue ml-1">✓</span>}<span className="block text-xs text-muted">{u.email}</span></td>
              <td>{u.plan?.name ?? "-"}{u.planExpires && <span className="block text-xs text-muted">until {formatDate(u.planExpires)}</span>}</td>
              <td>{u.roleRel ? u.roleRel.name : u.role}</td>
              <td><StatusBadge value={u.status === 1 ? "active" : u.status === 0 ? "banned" : "pending"} /></td>
              <td>{u._count.links}</td>
              <td className="text-muted">{formatDate(u.createdAt)}</td>
              <td><Link href={`/admin/users/${u.id}`} className="btn-secondary btn-sm">Edit</Link></td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/users", sp)} />
    </div>
  );
}
