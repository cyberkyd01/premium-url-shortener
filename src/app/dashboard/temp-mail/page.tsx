import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { listMailboxes, tempMailConfig, TEMPMAIL_MAX_USER } from "@/lib/tempmail";
import { PageHeader, Alert } from "@/components/ui";
import { TempMailDashboard } from "./temp-mail-client";

export const metadata = { title: "Temporary email" };

export default async function TempMailPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const cfg = await tempMailConfig();
  const mailboxes = cfg.enabled ? await listMailboxes(ws.userId) : [];
  return (
    <div>
      <PageHeader title="Temporary email" description={`Disposable inboxes for sign-ups and testing. Each inbox lives ${cfg.ttlMinutes} minutes (extendable) and you can keep up to ${TEMPMAIL_MAX_USER} at a time.`} />
      {!cfg.enabled ? <Alert type="info">Temporary email is not configured yet. An administrator needs to add at least one inbox domain.</Alert> : (
        <TempMailDashboard domains={cfg.domains} max={TEMPMAIL_MAX_USER} initial={mailboxes.map((m) => ({ id: m.id, address: m.address, token: m.token, expiresAt: m.expiresAt.toISOString(), unread: m.unread, total: m.total }))} />
      )}
    </div>
  );
}
