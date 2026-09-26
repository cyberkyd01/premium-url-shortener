import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { tempMailConfig, TEMPMAIL_PROVIDERS } from "@/lib/tempmail";
import { appUrl } from "@/lib/utils";
import { Card, CopyButton, Input, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { purgeTempMail, saveTempMailSettings } from "./actions";

const PROVIDER_HELP: Record<string, string> = {
  mailgun: "Mailgun → Receiving → Routes: match_recipient(\".*@yourdomain\") → forward to the webhook URL. Paste the Mailgun webhook signing key as the secret.",
  sendgrid: "SendGrid → Settings → Inbound Parse: add the host and set the destination URL to the webhook URL with ?secret=<secret> appended.",
  postmark: "Postmark → Inbound stream → Webhook URL. Set the URL to https://<secret>@your-host/... (basic auth) or append ?secret=<secret>.",
  cloudflare: "Cloudflare Email Routing → Email Worker: parse the message (e.g. with postal-mime) and POST JSON {to, from, subject, text, html} to the webhook with header x-tempmail-secret.",
  generic: "Any mail pipeline can POST JSON {to, from, subject, text, html, attachments:[{name,size,type}]} to the webhook with header x-tempmail-secret.",
};

export default async function TempMailAdmin() {
  await adminPage("settings.manage");
  const cfg = await tempMailConfig();
  const now = new Date();
  const [active, expired, emails] = await Promise.all([
    db.tempMailbox.count({ where: { expiresAt: { gt: now } } }), db.tempMailbox.count({ where: { expiresAt: { lte: now } } }), db.tempEmail.count(),
  ]);
  const webhook = appUrl(`/api/tempmail/inbound/${cfg.provider}`);
  return (
    <div>
      <PageHeader title="Temporary email" description="Disposable inboxes for users and (optionally) visitors. Point your inbound email provider at the webhook below." />
      <div className="grid sm:grid-cols-3 gap-4 mb-6"><Stat label="Active inboxes" value={active} /><Stat label="Expired (awaiting purge)" value={expired} sub="Purged by the tempmail cron job" /><Stat label="Stored messages" value={emails} /></div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Settings">
          <ActionForm action={saveTempMailSettings} submitLabel="Save settings">
            <Textarea label="Inbox domains" name="domains" defaultValue={cfg.domains.join("\n")} placeholder={"mail.example.com\ntmp.example.org"} hint="One per line. MX records of each domain must point to your inbound email provider. Leave empty to disable the feature." rows={4} />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Inbox lifetime (minutes)" name="ttl" type="number" min={5} max={10080} defaultValue={cfg.ttlMinutes} hint="Users can extend an inbox by this amount (max 7 days)." />
              <Select label="Inbound provider" name="provider" defaultValue={cfg.provider}>{TEMPMAIL_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
            </div>
            <SwitchField name="guests" label="Allow guests" hint="Visitors can create one inbox on /temp-mail without an account." defaultChecked={cfg.guests} />
            <Input label="Webhook secret" name="secret" type="password" autoComplete="new-password" placeholder={cfg.secret ? "•••••••• (saved, leave blank to keep)" : "Random string shared with the provider"} hint="Mailgun: the webhook signing key. Others: sent as x-tempmail-secret header or ?secret= query." />
            <input type="hidden" name="keepSecret" value="1" />
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card title="Inbound webhook URL">
            <div className="flex items-center gap-2"><code className="text-xs break-all flex-1">{webhook}</code><CopyButton text={webhook} /></div>
            <p className="text-xs text-muted mt-3">{PROVIDER_HELP[cfg.provider]}</p>
          </Card>
          <Card title="Maintenance">
            <p className="text-xs text-muted mb-3">Expired inboxes are removed by the <code>tempmail</code> cron job. You can also purge them now.</p>
            <ActionButton action={purgeTempMail}>Purge expired inboxes</ActionButton>
          </Card>
        </div>
      </div>
    </div>
  );
}
