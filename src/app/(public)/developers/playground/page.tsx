import type { Metadata } from "next";
import Link from "next/link";
import { Code2, FileJson, BookOpen } from "lucide-react";
import { playgroundCatalog } from "@/lib/openapi";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { ApiPlayground } from "@/components/public/api-playground";

export const metadata: Metadata = { title: "API Playground", description: "Try every developer API endpoint from your browser with your own API key." };
export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const s = await getSettings();
  const endpoints = playgroundCatalog();
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <div className="mb-8 md:mb-10">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3"><Code2 size={16} /> Developer API v1</div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">API playground</h1>
        <p className="mt-4 text-muted max-w-2xl text-lg">Pick an endpoint, fill in the parameters and send a live request from your browser to {s["site.name"]}. Every call runs against your own account, so treat write endpoints as real.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/developers" className="btn-secondary"><BookOpen size={16} /> API reference</Link>
          <a href="/api/v1/openapi.json" download="openapi.json" className="btn-secondary"><FileJson size={16} /> Download OpenAPI spec</a>
          {s["api.enabled"] !== "1" && <span className="badge-yellow self-center">The API is currently disabled by the administrator</span>}
        </div>
      </div>
      <ApiPlayground endpoints={endpoints} base={appUrl()} />
    </div>
  );
}
