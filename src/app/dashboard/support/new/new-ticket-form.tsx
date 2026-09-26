"use client";
import { useActionState } from "react";
import { Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { AttachmentsField } from "@/components/account/attachments-field";
import { createTicket } from "../actions";

export function NewTicketForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createTicket, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.length > 0 && <Select label="Category" name="categoryId"><option value="">General</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
        <Select label="Priority" name="priority" defaultValue="low"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></Select>
      </div>
      <Input label="Subject" name="subject" required minLength={3} placeholder="Short summary of the problem" />
      <Textarea label="Message" name="message" required minLength={10} placeholder="Describe what happened, what you expected and any links involved." className="[&_textarea]:min-h-40" />
      <AttachmentsField folder="tickets" />
      <FormMessage state={state} />
      <SubmitButton>Submit ticket</SubmitButton>
    </form>
  );
}
