import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { Card, PageHeader } from "@/components/ui";
import { NewTicketForm } from "./new-ticket-form";

export const metadata = { title: "New ticket" };

export default async function NewTicketPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const categories = await db.ticketCategory.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="max-w-2xl">
      <PageHeader title="New support ticket" description="Describe your issue and attach screenshots if helpful." />
      <Card><NewTicketForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} /></Card>
    </div>
  );
}
