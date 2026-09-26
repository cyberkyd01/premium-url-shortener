"use client";
import { useActionState } from "react";
import { Input, Select } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { cancelSubscription, resumeSubscription, redeemCode } from "./actions";

export function SubscriptionControls({ id, status }: { id: string; status: string }) {
  const [cancelState, cancelAction] = useActionState(cancelSubscription, null);
  const [resumeState, resumeAction] = useActionState(resumeSubscription, null);
  const cancelled = status === "cancelled";
  return (
    <div className="space-y-2">
      <form action={cancelled ? resumeAction : cancelAction} onSubmit={(e) => { if (!cancelled && !confirm("Cancel your subscription? Your plan stays active until the end of the paid period.")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant={cancelled ? "primary" : "danger"} size="sm">{cancelled ? "Resume subscription" : "Cancel subscription"}</SubmitButton>
      </form>
      <FormMessage state={cancelled ? resumeState : cancelState} />
    </div>
  );
}

export function RedeemForm({ plans }: { plans: { id: string; name: string }[] }) {
  const [state, action] = useActionState(redeemCode, null);
  return (
    <form action={action} className="space-y-3">
      <Input label="Coupon or voucher code" name="code" required placeholder="WELCOME2026" />
      <Select label="Plan (for codes valid on any plan)" name="planId"><option value="">Select a plan</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Redeem</SubmitButton>
    </form>
  );
}
