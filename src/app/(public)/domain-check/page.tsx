import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { appHost } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Domain check", robots: { index: false } };

export default async function DomainCheckPage() {
  const h = await headers();
  const s = await getSettings();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  const main = appHost().toLowerCase();
  const isCustom = !!host && host.split(":")[0] !== main.split(":")[0];
  const serverIp = process.env.SERVER_IP || "your server IP";
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      {isCustom ? (
        <div className="card p-8 text-center">
          <CheckCircle2 size={40} className="text-success mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Yes. Your domain name is working.</h1>
          <p className="text-muted mt-2"><span className="font-medium text-fg">{host}</span> is correctly pointed to {s["site.name"]}. Add it to your account now to start creating branded links.</p>
          <Link href="/dashboard/domains" className="btn-primary mt-6">Add it to your account</Link>
        </div>
      ) : (
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Connect your own domain</h1>
          <p className="text-muted mt-2 text-sm">Point your domain to {s["site.name"]}, then open <code>https://your-domain.com/domain-check</code> to verify the setup.</p>
          <div className="mt-6 space-y-4 text-sm">
            <div>
              <p className="font-semibold">Option 1 · A record (root domain, e.g. example.com)</p>
              <table className="table mt-2"><thead><tr><th>Type</th><th>Host</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>@</td><td>{serverIp}</td></tr></tbody></table>
            </div>
            <div>
              <p className="font-semibold">Option 2 · CNAME record (subdomain, e.g. go.example.com)</p>
              <table className="table mt-2"><thead><tr><th>Type</th><th>Host</th><th>Value</th></tr></thead><tbody><tr><td>CNAME</td><td>go</td><td>{main.split(":")[0]}</td></tr></tbody></table>
            </div>
            <p className="text-muted">DNS changes can take up to 24 hours to propagate. Once the domain resolves here, add it under <Link href="/dashboard/domains" className="text-primary">Dashboard → Domains</Link>{s["domains.verifyDns"] === "1" ? " and complete the verification step" : ""}.</p>
          </div>
        </div>
      )}
    </div>
  );
}
