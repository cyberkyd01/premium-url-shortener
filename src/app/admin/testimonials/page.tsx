import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, UploadField } from "@/components/admin/fields";
import { LinkTabs } from "@/components/admin/link-tabs";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveTestimonial, deleteTestimonial, saveFaq, deleteFaq } from "./actions";

export default async function TestimonialsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("testimonials.manage");
  const sp = await searchParams;
  const tab = qs(sp, "tab", "testimonials"), editId = qs(sp, "edit");
  const [testimonials, faqs] = await Promise.all([db.testimonial.findMany({ orderBy: { order: "asc" } }), db.faq.findMany({ orderBy: { order: "asc" } })]);
  const t = testimonials.find((x) => x.id === editId), f = faqs.find((x) => x.id === editId);
  return (
    <div>
      <PageHeader title="Testimonials & FAQ" />
      <LinkTabs active={tab} tabs={[{ key: "testimonials", label: "Testimonials", href: "/admin/testimonials" }, { key: "faq", label: "FAQ", href: "/admin/testimonials?tab=faq" }]} />
      {tab === "testimonials" ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Table count={testimonials.length} head={["", "Name", "Content", "Rating", "Order", "Status", ""]}>
              {testimonials.map((x) => <tr key={x.id}><td>{x.avatar && <img src={x.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}</td><td><span className="font-medium">{x.name}</span><span className="block text-xs text-muted">{x.role}</span></td><td className="max-w-sm text-muted text-xs">{x.content}</td><td>{"★".repeat(x.rating)}</td><td>{x.order}</td><td><StatusBadge value={x.active} /></td><td className="space-x-1 whitespace-nowrap"><Link href={`/admin/testimonials?edit=${x.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteTestimonial} hidden={{ id: x.id }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}
            </Table>
          </div>
          <Card title={t ? "Edit testimonial" : "Add testimonial"} actions={t && <Link href="/admin/testimonials" className="btn-ghost btn-sm">New</Link>}>
            <ActionForm key={t?.id ?? "new"} action={saveTestimonial} hidden={t ? { id: t.id } : undefined} submitLabel="Save">
              <Input label="Name" name="name" defaultValue={t?.name ?? ""} required /><Input label="Role / company" name="role" defaultValue={t?.role ?? ""} />
              <UploadField name="avatar" label="Avatar" defaultValue={t?.avatar ?? ""} folder="testimonials" />
              <Textarea label="Content" name="content" defaultValue={t?.content ?? ""} required />
              <div className="grid grid-cols-2 gap-3"><Input label="Rating (1-5)" name="rating" type="number" min={1} max={5} defaultValue={t?.rating ?? 5} /><Input label="Order" name="order" type="number" defaultValue={t?.order ?? 0} /></div>
              <SwitchField name="active" label="Active" defaultChecked={t?.active ?? true} />
            </ActionForm>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Table count={faqs.length} head={["Question", "Answer", "Order", "Status", ""]}>
              {faqs.map((x) => <tr key={x.id}><td className="font-medium">{x.question}</td><td className="max-w-sm text-muted text-xs">{x.answer}</td><td>{x.order}</td><td><StatusBadge value={x.active} /></td><td className="space-x-1 whitespace-nowrap"><Link href={`/admin/testimonials?tab=faq&edit=${x.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteFaq} hidden={{ id: x.id }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}
            </Table>
          </div>
          <Card title={f ? "Edit FAQ" : "Add FAQ"} actions={f && <Link href="/admin/testimonials?tab=faq" className="btn-ghost btn-sm">New</Link>}>
            <ActionForm key={f?.id ?? "new"} action={saveFaq} hidden={f ? { id: f.id } : undefined} submitLabel="Save">
              <Input label="Question" name="question" defaultValue={f?.question ?? ""} required /><Textarea label="Answer" name="answer" defaultValue={f?.answer ?? ""} required />
              <Input label="Order" name="order" type="number" defaultValue={f?.order ?? 0} /><SwitchField name="active" label="Active" defaultChecked={f?.active ?? true} />
            </ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
