import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { Alert, Card, CopyButton, PageHeader } from "@/components/ui";
import { appUrl, escapeHtml, json } from "@/lib/utils";
import { WEBHOOK_PROVIDERS } from "@/lib/webhooks";
import { WebhooksPanel } from "./webhooks-panel";

export const metadata = { title: "Integrations & tools" };

export default async function ToolsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  const { user, features } = await getUserPlan(ws.userId);
  const isAdmin = user.role === "admin";
  const hooks = await db.webhook.findMany({ where: { userId: ws.userId }, orderBy: { createdAt: "desc" } });
  const apiKey = user.apiKey ?? "";
  const bookmarklet = `javascript:(function(){window.open('${appUrl("/dashboard/links/new")}?url='+encodeURIComponent(location.href),'_blank','width=520,height=640');})();`;
  const canWebhooks = isAdmin || features.webhooks;
  const canSlack = (isAdmin || features.slack) && s["slack.enabled"] === "1";
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations & tools" description="Connect other apps and shorten links from anywhere." />

      <Card title="Webhooks & chat notifications" description="Get a JSON POST or a chat message whenever something happens in your account." actions={canWebhooks && <Link href="/dashboard/webhooks" className="btn-secondary btn-sm">Delivery logs</Link>}>
        {canWebhooks ? <WebhooksPanel hooks={hooks.map((h) => ({ id: h.id, name: h.name, url: h.url, events: json<string[]>(h.events, []), secret: h.secret, provider: h.provider, active: h.active, lastCalledAt: h.lastCalledAt?.toISOString() ?? null }))} zapier={s["zapier.enabled"] === "1"} providers={WEBHOOK_PROVIDERS.map((p) => ({ value: p.value, label: p.label, urlLabel: p.urlLabel, secretLabel: p.secretLabel, instructions: p.instructions }))} /> : <Alert type="warning">Webhooks are not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to connect Zapier, Slack, Discord, Telegram, Teams and custom endpoints.</Alert>}
        <div className="mt-4 text-xs text-muted space-y-1">
          <p><strong>Zapier / custom endpoints:</strong> the payload is <code>{"{ event, data, timestamp }"}</code>. Verify it by computing HMAC-SHA256 of the raw body with your secret and comparing with the <code>X-Signature</code> header.</p>
          <p><strong>Slack, Discord, Microsoft Teams:</strong> paste the channel&apos;s incoming webhook URL; events are posted as formatted messages. <strong>Telegram:</strong> use <code>https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage</code> as the URL and your chat id as the secret.</p>
          <p>Failed deliveries are retried automatically with backoff; see the <Link href="/dashboard/webhooks" className="underline">delivery logs</Link>.</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Slack" description="Shorten links without leaving Slack.">
          {!canSlack ? <Alert type="info">{s["slack.enabled"] !== "1" ? "The Slack integration is not enabled on this site." : <>Slack is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to use it.</>}</Alert> : (
            <div className="text-sm space-y-3">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Install the Slack app configured by the administrator (or create a Slack app with a slash command pointing to <code>{appUrl("/api/slack")}</code>).</li>
                <li>In the app configuration, paste your personal API key: <code className="bg-bg px-1 rounded">{apiKey ? apiKey.slice(0, 10) + "…" : "generate one in Settings → API"}</code></li>
                <li>Use <code className="bg-bg px-1 rounded">/shorten https://example.com/long-url</code> in any channel. Add a custom alias with <code className="bg-bg px-1 rounded">/shorten URL alias</code>.</li>
              </ol>
              <p className="text-xs text-muted">Admins: enable the integration in Admin → Settings → Integrations with your Slack client id, secret and signing secret.</p>
            </div>
          )}
        </Card>

        <Card title="API key" description="Use the REST API from your own apps and scripts.">
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-bg px-3 py-2 rounded-lg text-sm flex-1 min-w-48 truncate">{apiKey ? apiKey.slice(0, 12) + "••••••••••••" : "No API key yet"}</code>
            {apiKey && <CopyButton text={apiKey} />}
            <Link href="/dashboard/settings?tab=api" className="btn-secondary btn-sm">Manage keys</Link>
          </div>
          <p className="text-xs text-muted mt-3">Send it as <code>Authorization: Bearer YOUR_KEY</code>. See the <Link href="/developers" className="underline">API documentation</Link>.</p>
        </Card>

        {s["misc.bookmarklet"] === "1" && (
          <Card title="Bookmarklet" description="Drag this button to your bookmarks bar to shorten the page you are on.">
            <div className="flex flex-wrap items-center gap-3">
              <span dangerouslySetInnerHTML={{ __html: `<a href="${bookmarklet.replace(/"/g, "&quot;")}" class="btn-primary" draggable="true">Shorten with ${escapeHtml(s["site.name"])}</a>` }} />
              <CopyButton text={bookmarklet} label="Copy code" />
            </div>
            <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted">Show code</summary><pre className="bg-bg rounded-lg p-3 mt-2 overflow-auto whitespace-pre-wrap break-all">{bookmarklet}</pre></details>
          </Card>
        )}

        {s["misc.extension"] === "1" && (
          <Card title="Browser extension & WordPress" description="Shorten links from your browser toolbar or your WordPress site.">
            <ul className="text-sm space-y-2">
              <li><a href="https://chrome.google.com/webstore/search/url%20shortener" target="_blank" rel="noreferrer" className="text-primary underline">Chrome extension</a> — install, open the options page and paste your API key and site URL <code className="bg-bg px-1 rounded">{appUrl()}</code>.</li>
              <li><a href="https://wordpress.org/plugins/search/url+shortener/" target="_blank" rel="noreferrer" className="text-primary underline">WordPress plugin</a> — connect with your API key to shorten every post automatically.</li>
            </ul>
          </Card>
        )}

        <Card title="Parameter forwarding" description="Pass query parameters from your short link to the destination.">
          <div className="text-sm space-y-2">
            <p>Enable <strong>Forward parameters</strong> on a link and anything appended to the short URL is forwarded to the destination:</p>
            <p><code className="bg-bg px-1 rounded">{appUrl("/promo")}?utm_source=newsletter</code> → <code className="bg-bg px-1 rounded">https://shop.com/sale?utm_source=newsletter</code></p>
            <p className="text-muted text-xs">Works together with UTM builder, custom parameters and parameter templates (Dashboard → Parameter Templates).</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
