import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { Alert, Badge, Card, PageHeader, Stat } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { TwilioForm, ContactsPanel, SendForm } from "./sms-forms";

export const metadata = { title: "Send SMS" };

export default async function SmsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { user, plan } = await getUserPlan(ws.userId);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [contacts, messages, usedMonth] = await Promise.all([
    db.smsContact.findMany({ where: { userId: ws.userId }, orderBy: { createdAt: "desc" } }),
    db.smsMessage.findMany({ where: { userId: ws.userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.smsMessage.count({ where: { userId: ws.userId, createdAt: { gte: monthStart } } }),
  ]);
  const limit = user.role === "admin" ? -1 : plan?.limitSms ?? 0;
  const remaining = limit === -1 ? Infinity : Math.max(0, limit - usedMonth);
  const configured = !!(user.twilioSid && user.twilioToken && user.twilioFrom);
  const color = (s: string) => (s === "delivered" || s === "sent" ? "green" : s === "failed" ? "red" : "yellow");
  return (
    <div className="space-y-6">
      <PageHeader title="Send SMS" description="Send text messages with your Twilio account. URLs in messages are shortened automatically." />
      {limit === 0 && <Alert type="warning">Your plan does not include SMS sending. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to unlock it.</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Sent this month" value={`${usedMonth}${limit === -1 ? "" : ` / ${limit}`}`} />
        <Stat label="Contacts" value={contacts.length} />
        <Stat label="Twilio" value={configured ? <Badge color="green">Connected</Badge> : <Badge color="gray">Not configured</Badge>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="New message"><SendForm contacts={contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))} configured={configured && limit !== 0} remaining={remaining} /></Card>
          <Card title="Message history">
            {messages.length === 0 ? <p className="text-sm text-muted">No messages sent yet.</p> : (
              <div className="overflow-x-auto -mx-5 -my-5"><table className="table">
                <thead><tr><th>Date</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
                <tbody>{messages.map((m) => <tr key={m.id}><td className="whitespace-nowrap">{formatDate(m.createdAt, true)}</td><td>{m.to}</td><td className="max-w-72 truncate" title={m.body}>{m.body}</td><td><Badge color={color(m.status)}>{m.status}</Badge>{m.error && <p className="text-xs text-danger mt-1 max-w-48 truncate" title={m.error}>{m.error}</p>}</td></tr>)}</tbody>
              </table></div>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Twilio settings" description="Find these in your Twilio console."><TwilioForm sid={user.twilioSid ?? ""} from={user.twilioFrom ?? ""} hasToken={!!user.twilioToken} /></Card>
          <Card title="Contacts"><ContactsPanel contacts={contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))} /></Card>
        </div>
      </div>
    </div>
  );
}
