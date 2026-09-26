import type { HostedFile } from "@prisma/client";
import { FileDown, Lock } from "lucide-react";
import { InterstitialShell } from "./shell";
import { PasswordForm } from "./password-form";
import type { ActionState } from "@/components/ui/form-state";
import { json } from "@/lib/utils";

export interface FileBranding { title?: string; description?: string; logo?: string; color?: string }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function DownloadPage({ file, siteName, logo, locked, expired, unlockAction, downloadAction, captcha }: {
  file: HostedFile; siteName: string; logo?: string; locked: boolean; expired: boolean;
  unlockAction: (prev: ActionState, fd: FormData) => Promise<ActionState>; downloadAction: (fd: FormData) => Promise<void>;
  captcha: { provider: string; siteKey: string } | null;
}) {
  const b = json<FileBranding>(file.branding, {});
  const title = b.title || file.name;
  return (
    <InterstitialShell meta={{ title, description: b.description }} siteName={siteName} logo={logo}>
      {expired ? (
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-bold">This file is no longer available</h1>
          <p className="text-muted mt-2">The download link has expired.</p>
        </div>
      ) : locked ? (
        <PasswordForm action={unlockAction} id={file.id} title={title} hint="This file is password protected." captcha={captcha} />
      ) : (
        <div className="card max-w-md w-full p-8 text-center">
          {b.logo && <img src={b.logo} alt="" className="h-10 mx-auto mb-4" />}
          <div className="mx-auto h-12 w-12 rounded-full grid place-items-center mb-4" style={{ background: (b.color || "#6366f1") + "22", color: b.color || "#6366f1" }}>{file.password ? <Lock size={22} /> : <FileDown size={22} />}</div>
          <h1 className="text-xl font-bold break-words">{title}</h1>
          {b.description && <p className="text-muted mt-2">{b.description}</p>}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
            <div><dt>File</dt><dd className="text-fg font-medium truncate">{file.name}</dd></div>
            <div><dt>Size</dt><dd className="text-fg font-medium">{formatSize(file.size)}</dd></div>
            <div><dt>Downloads</dt><dd className="text-fg font-medium">{file.downloads}</dd></div>
          </dl>
          <form action={downloadAction} className="mt-6">
            <input type="hidden" name="id" value={file.id} />
            <button className="btn-primary w-full" style={b.color ? { background: b.color, color: "#fff" } : undefined}><FileDown size={16} /> Download</button>
          </form>
          {file.encrypted && <p className="hint mt-3">This file is encrypted. You will need the decryption key provided by the sender.</p>}
        </div>
      )}
    </InterstitialShell>
  );
}
