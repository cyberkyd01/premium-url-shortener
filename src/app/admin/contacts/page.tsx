import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { Table, Ids } from "@/components/admin/table";
import { contactQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function ContactsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("tools.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), read = qs(sp, "read");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.ContactWhereInput = { ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { subject: { contains: q } }, { message: { contains: q } }] } : {}), ...(read === "1" ? { read: true } : read === "0" ? { read: false } : {}) };
  const [rows, total] = await Promise.all([db.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), db.contact.count({ where })]);
  return (
    <div>
      <PageHeader title="Contact messages" description={`${total} messages`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Name, email, subject" }, { name: "read", type: "select", value: read, options: [{ value: "", label: "All" }, { value: "0", label: "Unread" }, { value: "1", label: "Read" }] }]} />
      <BulkForm action={contactQuick} options={[{ value: "read", label: "Mark read" }, { value: "unread", label: "Mark unread" }, { value: "delete", label: "Delete" }]}>
        <Table count={rows.length} head={["", "From", "Subject / message", "IP", "Date", ""]}>
          {rows.map((c) => (
            <tr key={c.id} className={c.read ? "" : "font-medium"}>
              <td><Ids id={c.id} /></td>
              <td>{c.name}<span className="block text-xs text-muted font-normal">{c.email}</span></td>
              <td className="max-w-lg"><span>{c.subject ?? "(no subject)"}</span><span className="block text-xs text-muted font-normal whitespace-pre-wrap">{c.message}</span></td>
              <td className="text-xs text-muted">{c.ip ?? "-"}</td>
              <td className="text-muted font-normal">{formatDate(c.createdAt, true)}</td>
              <td className="whitespace-nowrap space-x-1">
                <a href={`mailto:${c.email}?subject=${encodeURIComponent("Re: " + (c.subject ?? "your message"))}`} className="btn-primary btn-sm">Reply</a>
                <RowAction action={contactQuick} hidden={{ id: c.id, op: c.read ? "unread" : "read" }}>{c.read ? "Unread" : "Read"}</RowAction>
                <RowAction action={contactQuick} hidden={{ id: c.id, op: "delete" }} variant="danger" confirm="Delete message?">Delete</RowAction>
              </td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/contacts", sp)} />
    </div>
  );
}
