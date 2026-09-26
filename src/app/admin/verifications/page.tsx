import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { reviewVerification } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("verification.manage");
  const sp = await searchParams;
  const status = qs(sp, "status", "pending"), type = qs(sp, "type");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.VerificationRequestWhereInput = { ...(status ? { status } : {}), ...(type ? { type } : {}) };
  const [rows, total] = await Promise.all([
    db.verificationRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true, email: true, verified: true } } } }),
    db.verificationRequest.count({ where }),
  ]);
  return (
    <div>
      <PageHeader title="Verification requests" description="Verified badge, email verification and two-factor reset requests." />
      <FilterBar fields={[
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }] },
        { name: "type", type: "select", value: type, options: [{ value: "", label: "All types" }, { value: "badge", label: "Verified badge" }, { value: "email", label: "Email" }, { value: "2fa_reset", label: "2FA reset" }] },
      ]} />
      <Table count={rows.length} head={["User", "Type", "Message", "Document", "Status", "Date", ""]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/admin/users/${r.user.id}`} className="font-medium">{r.user.username}</Link><span className="block text-xs text-muted">{r.user.email}</span></td>
            <td>{r.type}</td>
            <td className="max-w-sm whitespace-pre-wrap text-muted">{r.message ?? "-"}</td>
            <td>{r.document ? <a href={r.document} target="_blank" className="text-primary">View</a> : "-"}</td>
            <td><StatusBadge value={r.status} /></td>
            <td>{formatDate(r.createdAt)}</td>
            <td className="whitespace-nowrap space-x-1">
              {r.status === "pending" && <><ActionButton action={reviewVerification} hidden={{ id: r.id, op: "approve" }} variant="primary">Approve</ActionButton><ActionButton action={reviewVerification} hidden={{ id: r.id, op: "reject" }}>Reject</ActionButton></>}
              <ActionButton action={reviewVerification} hidden={{ id: r.id, op: "delete" }} variant="ghost" confirm="Delete request?">Delete</ActionButton>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/verifications", sp)} />
    </div>
  );
}
