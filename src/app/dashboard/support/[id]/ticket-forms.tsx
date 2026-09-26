"use client";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { AttachmentsField } from "@/components/account/attachments-field";
import { replyTicket, rateTicket } from "../actions";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyTicket, null);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? String(Date.now()) : "reply"}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="message" required placeholder="Write your reply…" />
      <AttachmentsField folder="tickets" />
      <FormMessage state={state} />
      <SubmitButton>Send reply</SubmitButton>
    </form>
  );
}

export function RatingForm({ ticketId, rating, comment }: { ticketId: string; rating: number | null; comment: string | null }) {
  const [state, action] = useActionState(rateTicket, null);
  const [value, setValue] = useState(rating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="rating" value={value} />
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={!!rating} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setValue(n)} className="text-warning"><Star size={24} fill={(hover || value) >= n ? "currentColor" : "none"} /></button>)}</div>
      {rating ? (comment && <p className="text-sm text-muted">{comment}</p>) : (
        <>
          <Textarea name="comment" placeholder="Optional comment" />
          <FormMessage state={state} />
          <SubmitButton variant="secondary">Submit rating</SubmitButton>
        </>
      )}
    </form>
  );
}
