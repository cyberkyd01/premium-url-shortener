import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { adminCreateLink } from "../actions";

export default async function NewLinkPage() {
  await adminPage("links.manage");
  const domains = await db.domain.findMany({ where: { status: 1 }, orderBy: { domain: "asc" } });
  return (
    <div className="max-w-2xl">
      <PageHeader title="Create short link" description="Created as the admin account (no plan limits) or on behalf of a user." />
      <Card>
        <ActionForm action={adminCreateLink} submitLabel="Create link">
          <Input label="Destination URL" name="url" type="url" required placeholder="https://example.com/page" />
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Custom alias" name="alias" placeholder="Leave blank for random" />
            <Select label="Domain" name="domainId"><option value="">Main domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</Select>
            <Input label="Title" name="title" />
            <Select label="Redirect type" name="redirectType" defaultValue="direct">{["direct", "frame", "splash", "custom", "overlay"].map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Input label="Password" name="password" />
            <Input label="Expires at" name="expiresAt" type="datetime-local" />
            <Input label="Click limit" name="clickLimit" type="number" min={0} />
            <Input label="Owner (username or email)" name="owner" placeholder="Leave blank for your account" />
          </div>
          <Textarea label="Description" name="description" />
          <Textarea label="Notes (private)" name="notes" />
        </ActionForm>
      </Card>
    </div>
  );
}
