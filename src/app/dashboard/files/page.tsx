import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { isLocalStorage } from "@/lib/hosted-files";
import { Alert, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { appUrl, json } from "@/lib/utils";
import { UploadForm, FilesTable, type FileRow } from "./file-forms";

export const metadata = { title: "File hosting" };

export default async function FilesPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { user, plan } = await getUserPlan(ws.userId);
  const isAdmin = user.role === "admin";
  const [files, domains, local] = await Promise.all([
    db.hostedFile.findMany({ where: { userId: ws.userId }, orderBy: { createdAt: "desc" } }),
    db.domain.findMany({ where: { status: 1, OR: [{ userId: ws.userId }, { isPublic: true }] }, select: { id: true, domain: true } }),
    isLocalStorage(),
  ]);
  const limitFiles = isAdmin ? -1 : plan?.limitFiles ?? 0;
  const limitMb = isAdmin ? -1 : plan?.limitStorageMb ?? 0;
  const canUpload = limitFiles !== 0 && (limitFiles === -1 || files.length < limitFiles);
  const usedMb = user.storageUsed / 1048576;
  const rows: FileRow[] = files.map((f) => {
    const d = f.domainId ? domains.find((x) => x.id === f.domainId) : null;
    return { id: f.id, alias: f.alias, name: f.name, size: f.size, mime: f.mime, hasPassword: !!f.password, expiresAt: f.expiresAt?.toISOString() ?? null, encrypted: f.encrypted, branding: json(f.branding, {}), downloads: f.downloads, createdAt: f.createdAt.toISOString(), domainId: f.domainId, url: d ? `https://${d.domain}/${f.alias}` : appUrl("/" + f.alias) };
  });
  return (
    <div className="space-y-6">
      <PageHeader title="File hosting" description="Upload files and share them through short download pages." />
      {limitFiles === 0 && <Alert type="warning">Your plan does not include file hosting. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to host files.</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Files" value={`${files.length}${limitFiles === -1 ? "" : ` / ${limitFiles}`}`} />
        <Stat label="Storage used" value={`${usedMb.toFixed(1)} MB${limitMb === -1 ? "" : ` / ${limitMb} MB`}`} />
        <Stat label="Total downloads" value={files.reduce((a, f) => a + f.downloads, 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Upload a file" className="lg:col-span-1"><UploadForm domains={domains} localStorage={local} canUpload={canUpload} /></Card>
        <Card title="Your files" className="lg:col-span-2">
          {rows.length === 0 ? <Empty title="No files yet" description="Upload your first file to get a shareable download link." /> : <FilesTable files={rows} domains={domains} />}
        </Card>
      </div>
    </div>
  );
}
