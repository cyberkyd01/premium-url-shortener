"use client";
import { useActionState, useState } from "react";
import { Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { requestPayout } from "./actions";

export function PayoutForm({ available, min, currency }: { available: number; min: number; currency: string }) {
  const [state, action] = useActionState(requestPayout, null);
  const [method, setMethod] = useState("paypal");
  const disabled = available < min;
  return (
    <form action={action} className="space-y-3">
      <Input label={`Amount (${currency})`} name="amount" type="number" step="0.01" min={min} max={available} defaultValue={available >= min ? available.toFixed(2) : ""} required disabled={disabled} hint={`Available: ${available.toFixed(2)} · Minimum: ${min.toFixed(2)}`} />
      <Select label="Payout method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={disabled}><option value="paypal">PayPal</option><option value="bank">Bank transfer</option></Select>
      {method === "paypal" ? <Input label="PayPal email" name="details" type="email" required disabled={disabled} /> : <Textarea label="Bank details" name="details" required disabled={disabled} placeholder="Account holder, IBAN / account number, SWIFT / routing, bank name" />}
      <FormMessage state={state} />
      {disabled ? <p className="text-sm text-muted">You need at least {min.toFixed(2)} {currency} available to request a payout.</p> : <SubmitButton>Request payout</SubmitButton>}
    </form>
  );
}
