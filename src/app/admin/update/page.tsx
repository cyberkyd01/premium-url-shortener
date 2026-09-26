import { promises as fs } from "fs";
import path from "path";
import { adminPage } from "@/lib/admin/guard";
import { getSetting } from "@/lib/settings";
import { APP_VERSION, systemInfo } from "@/lib/admin/system";
import { Alert, Card, CopyButton, PageHeader } from "@/components/ui";
import Link from "next/link";

export default async function UpdateAdmin() {
  await adminPage("tools.manage");
  const [channel, info] = await Promise.all([getSetting("misc.updateChannel"), systemInfo()]);
  let changelog = "";
  try { changelog = await fs.readFile(path.join(process.cwd(), "docs", "CHANGELOG.md"), "utf8"); } catch { changelog = ""; }
  const latestHeading = changelog.match(/^## \[([^\]]+)\]/m)?.[1] ?? APP_VERSION;
  const upToDate = latestHeading === APP_VERSION;
  const cmd = "git pull && pnpm install && pnpm prisma db push && pnpm build && pm2 restart all";
  return (
    <div>
      <PageHeader title="Update" description={`Installed version ${APP_VERSION} · channel: ${channel}`} actions={<Link href="/admin/settings?tab=advanced" className="btn-secondary">Change channel</Link>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Check for updates">
            {upToDate ? <Alert type="success">You are running the latest version listed in the changelog ({latestHeading}).</Alert> : <Alert type="warning">The changelog lists version {latestHeading}; you run {APP_VERSION}. Follow the update steps.</Alert>}
            <p className="hint mt-3">Automatic update checks use the "{channel}" channel. Updates are delivered through your git remote; there is no remote update server.</p>
          </Card>
          <Card title="How to update" actions={<CopyButton text={cmd} />}>
            <ol className="list-decimal pl-5 text-sm space-y-2">
              <li>Back up the database (SQLite: copy <code>prisma/dev.db</code>; Tools → Export for JSON).</li>
              <li>Run on the server:<pre className="bg-bg rounded-lg p-2 mt-1 text-xs overflow-auto">git pull{"\n"}pnpm install{"\n"}pnpm prisma db push{"\n"}pnpm build</pre></li>
              <li>Restart the Node process (pm2, systemd, Docker…).</li>
              <li>Open Tools → Clear cache.</li>
            </ol>
          </Card>
          <Card title="Environment"><dl className="text-sm grid grid-cols-2 gap-y-1"><dt className="text-muted">Node.js</dt><dd>{info.node}</dd><dt className="text-muted">Database</dt><dd>{info.db}</dd><dt className="text-muted">Mode</dt><dd>{info.env}</dd></dl></Card>
        </div>
        <Card title="Changelog" className="lg:col-span-2">
          {changelog ? <pre className="text-xs whitespace-pre-wrap font-sans leading-6 max-h-[70vh] overflow-auto">{changelog}</pre> : <p className="text-sm text-muted">docs/CHANGELOG.md not found.</p>}
        </Card>
      </div>
    </div>
  );
}
