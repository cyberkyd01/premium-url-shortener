import { adminPage } from "@/lib/admin/guard";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { Card, CopyButton, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { saveIntegrations } from "./actions";

function Secret({ name, label, set }: { name: string; label: string; set: boolean }) {
  return <Input label={label} name={name} type="password" placeholder={set ? "•••••••• (saved, leave blank to keep)" : ""} autoComplete="new-password" />;
}

export default async function IntegrationsAdmin() {
  await adminPage("integrations.manage");
  const s = await getSettings();
  const slackUrl = appUrl("/api/webhook/slack");
  return (
    <div>
      <PageHeader title="Integrations" description="Third-party services. Secrets are hidden once saved." />
      <ActionForm action={saveIntegrations} submitLabel="Save integrations">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Slack app" description="Lets users shorten links with a slash command.">
            <div className="space-y-3">
              <SwitchField name="slack.enabled" label="Slack integration enabled" defaultChecked={s["slack.enabled"] === "1"} />
              <Input label="Client ID" name="slack.clientId" defaultValue={s["slack.clientId"]} />
              <Secret name="slack.clientSecret" label="Client secret" set={!!s["slack.clientSecret"]} />
              <Secret name="slack.signingSecret" label="Signing secret" set={!!s["slack.signingSecret"]} />
              <Secret name="slack.verificationToken" label="Verification token (legacy)" set={!!s["slack.verificationToken"]} />
              <div className="rounded-lg bg-bg p-3 text-xs space-y-2">
                <p className="font-medium">Setup</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted">
                  <li>Create an app at api.slack.com → Slash Commands → add <code>/shorten</code>.</li>
                  <li>Request URL: <code className="break-all">{slackUrl}</code> <CopyButton text={slackUrl} /></li>
                  <li>Usage: <code>/shorten https://example.com [alias]</code>. Users connect their account in Dashboard → Integrations.</li>
                </ol>
              </div>
            </div>
          </Card>
          <Card title="Zapier & webhooks">
            <div className="space-y-3">
              <SwitchField name="zapier.enabled" label="Zapier / custom webhooks enabled" hint="Users create webhooks in their dashboard (link.created, link.clicked, bio.viewed, qr.scanned)." defaultChecked={s["zapier.enabled"] === "1"} />
              <p className="text-xs text-muted">Webhook payloads are signed with the per-hook secret (header <code>x-signature</code>, HMAC-SHA256).</p>
            </div>
          </Card>
          <Card title="Social login" description="Keys live in .env: GOOGLE_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET, TWITTER_CLIENT_ID/SECRET.">
            <div className="space-y-3">
              <SwitchField name="social.google" label="Google" defaultChecked={s["social.google"] === "1"} />
              <SwitchField name="social.facebook" label="Facebook" defaultChecked={s["social.facebook"] === "1"} />
              <SwitchField name="social.twitter" label="X / Twitter" defaultChecked={s["social.twitter"] === "1"} />
              <div className="text-xs text-muted space-y-1">{["google", "facebook", "twitter"].map((p) => <div key={p} className="flex items-center gap-2"><span className="w-16 capitalize">{p}</span><code className="flex-1 break-all">{appUrl(`/api/auth/callback/${p}`)}</code><CopyButton text={appUrl(`/api/auth/callback/${p}`)} /></div>)}</div>
            </div>
          </Card>
          <Card title="Mailchimp & Giphy (bio pages)">
            <div className="space-y-3">
              <Secret name="bio.mailchimpKey" label="Mailchimp API key" set={!!s["bio.mailchimpKey"]} />
              <Input label="Mailchimp audience/list ID" name="bio.mailchimpList" defaultValue={s["bio.mailchimpList"]} />
              <Secret name="bio.giphyKey" label="Giphy API key" set={!!s["bio.giphyKey"]} />
            </div>
          </Card>
          <Card title="Chat widget">
            <div className="space-y-3">
              <Select label="Provider" name="chat.provider" defaultValue={s["chat.provider"]}>{["none", "intercom", "tidio", "tawk", "crisp"].map((p) => <option key={p} value={p}>{p}</option>)}</Select>
              <Input label="Widget ID / key" name="chat.id" defaultValue={s["chat.id"]} />
            </div>
          </Card>
          <Card title="Safe browsing">
            <div className="space-y-3">
              <SwitchField name="links.webrisk" label="Google Web Risk" defaultChecked={s["links.webrisk"] === "1"} />
              <Secret name="links.webriskKey" label="Web Risk API key" set={!!s["links.webriskKey"]} />
              <SwitchField name="links.phishtank" label="PhishTank" hint="Public API, no key required" defaultChecked={s["links.phishtank"] === "1"} />
            </div>
          </Card>
          <Card title="Google Analytics">
            <div className="space-y-3">
              <Select label="Click tracking" name="links.trackingMethod" defaultValue={s["links.trackingMethod"]}><option value="system">Built-in statistics</option><option value="ga">Google Analytics (redirect page)</option></Select>
              <Input label="GA measurement ID" name="links.gaId" defaultValue={s["links.gaId"]} placeholder="G-XXXXXXX" />
              <Textarea label="Site analytics code" name="analytics.code" defaultValue={s["analytics.code"]} hint="Injected on public pages" />
            </div>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
