import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { BookmarkletButton } from "@/components/public/bookmarklet-button";
import { Section, SectionTitle } from "@/components/public/section";
import { Bookmark, Chrome, Globe, MessageSquare, Zap } from "lucide-react";

export const metadata: Metadata = { title: "Tools & integrations", description: "Bookmarklet, Chrome extension, WordPress plugin, Zapier and Slack integrations." };

export default async function ToolsPage() {
  const s = await getSettings();
  const bookmarklet = `javascript:(function(){var u=encodeURIComponent(location.href);fetch('${appUrl("/api/shorten")}',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({url:location.href})}).then(function(r){return r.json()}).then(function(d){if(d.error){alert(d.message||'Error');return;}prompt('Your short link:',d.short);}).catch(function(){window.open('${appUrl("/")}?url='+u);});})();`;
  return (
    <>
      <Section className="pb-4"><SectionTitle eyebrow="Tools" title="Shorten from anywhere" description="Browser tools, plugins and integrations that connect your workflow to your account." /></Section>
      <Section className="py-6 space-y-6">
        {s["misc.bookmarklet"] === "1" && (
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-lg mb-2"><Bookmark size={18} className="text-primary" /> Bookmarklet</div>
            <p className="text-sm text-muted mb-4">Drag the button below to your bookmarks bar. Click it on any page to shorten the current URL instantly (log in first to save links to your account).</p>
            <BookmarkletButton code={bookmarklet} label={`Shorten with ${s["site.name"]}`} />
            <pre className="mt-4 text-xs bg-fg/5 rounded-lg p-3 overflow-auto max-h-32"><code>{bookmarklet}</code></pre>
          </div>
        )}
        {s["misc.extension"] === "1" && (
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-lg mb-2"><Chrome size={18} className="text-primary" /> Chrome extension</div>
            <p className="text-sm text-muted mb-4">Shorten the current tab, choose a domain and alias, and copy the result without leaving the page. Works with Chrome, Edge, Brave and other Chromium browsers.</p>
            <ol className="text-sm list-decimal pl-5 space-y-1 mb-4">
              <li>Download the extension package and unzip it.</li>
              <li>Open <code>chrome://extensions</code>, enable Developer mode and click "Load unpacked".</li>
              <li>Open the extension options and paste your API key from <Link href="/dashboard/api" className="text-primary">Dashboard → API</Link>.</li>
            </ol>
            <a href="/integrations/chrome-extension.zip" className="btn-secondary">Download extension (.zip)</a>
            <p className="hint mt-2">If the download is not available yet, ask the site administrator to publish the extension package.</p>
          </div>
        )}
        <div className="card p-6">
          <div className="flex items-center gap-2 font-semibold text-lg mb-2"><Globe size={18} className="text-primary" /> WordPress plugin</div>
          <p className="text-sm text-muted mb-4">Automatically create short links for new posts and insert them from the editor. Install the plugin, then enter your site URL and API key in the plugin settings.</p>
          <a href="/integrations/wordpress-plugin.zip" className="btn-secondary">Download plugin (.zip)</a>
        </div>
        {s["zapier.enabled"] === "1" && (
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-lg mb-2"><Zap size={18} className="text-primary" /> Zapier & webhooks</div>
            <p className="text-sm text-muted">Trigger zaps when links are created or clicked, or create short links from any Zapier trigger. Add a Zapier webhook under <Link href="/dashboard/integrations" className="text-primary">Dashboard → Integrations</Link>, or send events to your own endpoint with signed webhooks.</p>
          </div>
        )}
        {s["slack.enabled"] === "1" && (
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold text-lg mb-2"><MessageSquare size={18} className="text-primary" /> Slack</div>
            <p className="text-sm text-muted">Connect Slack from <Link href="/dashboard/integrations" className="text-primary">Dashboard → Integrations</Link> and use <code>/shorten https://example.com</code> in any channel to create short links.</p>
          </div>
        )}
        <div className="card p-6">
          <div className="flex items-center gap-2 font-semibold text-lg mb-2"><Zap size={18} className="text-primary" /> Developer API</div>
          <p className="text-sm text-muted">Integrate with anything using our REST API. See the <Link href="/developers" className="text-primary">API documentation</Link>.</p>
        </div>
      </Section>
    </>
  );
}
