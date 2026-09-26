"use client";
import { useActionState, useState, useTransition } from "react";
import { Card, Input, Badge, Alert, Button, Textarea, CopyButton } from "@/components/ui";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import { changePassword, beginTwoFactor, enableTwoFactor, enableEmailTwoFactor, disableTwoFactor, requestTwoFactorReset, disconnectAccount, clearLoginHistory } from "./actions";
import { BackupCodes } from "./backup-codes";

export function SecurityTab({ user, settings, accounts, history, pendingReset }: {
  user: { hasPassword: boolean; twoFactorEnabled: boolean; twoFactorMethod: string; emailVerified: boolean; backupCodesCount: number };
  settings: { twoFactor: boolean; emailTwoFactor: boolean; siteName: string };
  accounts: { id: string; provider: string }[];
  history: { id: string; ip: string | null; userAgent: string | null; country: string | null; success: boolean; createdAt: string }[];
  pendingReset: boolean;
}) {
  const [pwState, pwAction] = useActionState(changePassword, null);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [setupMsg, setSetupMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const [enableState, enableAction] = useActionState(enableTwoFactor, null);
  const [disableState, disableAction] = useActionState(disableTwoFactor, null);
  const [resetState, resetAction] = useActionState(requestTwoFactorReset, null);
  const [historyState, setHistoryState] = useState<ActionState>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Change password" description={user.hasPassword ? undefined : "You signed up with a social account. Set a password to enable email login."}>
        <form action={pwAction} className="space-y-3">
          {user.hasPassword && <Input label="Current password" name="current" type="password" autoComplete="current-password" required />}
          <Input label="New password" name="password" type="password" autoComplete="new-password" required />
          <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          <FormMessage state={pwState} />
          <SubmitButton>Update password</SubmitButton>
        </form>
      </Card>

      <Card title="Two-factor authentication" description="Add a second step to your login." actions={user.twoFactorEnabled ? <Badge color="green">Enabled ({user.twoFactorMethod})</Badge> : <Badge color="gray">Disabled</Badge>}>
        {!settings.twoFactor ? <Alert type="info">Two-factor authentication is disabled by the administrator.</Alert> : user.twoFactorEnabled ? (
          <div className="space-y-4">
            <form action={disableAction} className="space-y-3">
              {user.hasPassword && <Input label="Confirm your password to disable" name="password" type="password" required />}
              <FormMessage state={disableState} />
              <SubmitButton variant="danger">Disable 2FA</SubmitButton>
            </form>
            <BackupCodes remaining={user.backupCodesCount} siteName={settings.siteName} />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Lost access to your device? Request a 2FA reset</summary>
              {pendingReset ? <p className="mt-2 text-muted">A reset request is pending review.</p> : (
                <form action={resetAction} className="mt-2 space-y-2">
                  <Textarea name="message" placeholder="Explain your situation (optional)" />
                  <FormMessage state={resetState} />
                  <SubmitButton variant="secondary" size="sm">Request reset</SubmitButton>
                </form>
              )}
            </details>
          </div>
        ) : (
          <div className="space-y-4">
            {!setup ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={pending} onClick={() => start(async () => { const r = await beginTwoFactor(); if (r?.data) setSetup(r.data as { secret: string; otpauth: string }); setSetupMsg(r?.error ? r : null); })}>Set up authenticator app</Button>
                {settings.emailTwoFactor && <Button type="button" variant="secondary" disabled={pending || !user.emailVerified} onClick={() => start(async () => { setSetupMsg(await enableEmailTwoFactor()); })}>Use email codes</Button>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">Scan this QR code with Google Authenticator, Authy or 1Password, then enter the 6-digit code.</p>
                <img src={`/api/qr/render?data=${encodeURIComponent(setup.otpauth)}&size=200`} alt="2FA QR code" className="h-48 w-48 rounded-lg border border-border bg-white p-2" />
                <div className="flex items-center gap-2 text-xs"><code className="bg-bg px-2 py-1 rounded break-all">{setup.secret}</code><CopyButton text={setup.secret} /></div>
                <form action={enableAction} className="flex items-end gap-2">
                  <Input label="Verification code" name="code" inputMode="numeric" pattern="[0-9 ]{6,8}" required placeholder="123456" className="flex-1" />
                  <SubmitButton>Enable</SubmitButton>
                </form>
                <FormMessage state={enableState} />
              </div>
            )}
            <FormMessage state={setupMsg} />
            {!user.emailVerified && settings.emailTwoFactor && <p className="hint">Verify your email to use email codes.</p>}
          </div>
        )}
      </Card>

      <Card title="Connected accounts" description="Social logins linked to your account.">
        {accounts.length === 0 ? <p className="text-sm text-muted">No social accounts connected.</p> : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize font-medium">{a.provider}</span>
                <ConfirmForm action={disconnectAccount} hidden={{ id: a.id }} message="Disconnect this account?"><Button type="submit" variant="ghost" size="sm" disabled={!user.hasPassword && accounts.length <= 1}>Disconnect</Button></ConfirmForm>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Login history" description="Your most recent sign-in attempts." actions={history.length > 0 && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { if (!confirm("Clear your login history?")) return; start(async () => { setHistoryState(await clearLoginHistory()); }); }}>Clear history</Button>}>
        <FormMessage state={historyState} />
        {history.length === 0 ? <p className="text-sm text-muted">No login history yet.</p> : (
          <div className="overflow-x-auto -mx-5"><table className="table">
            <thead><tr><th>Date</th><th>IP</th><th>Country</th><th>Device</th><th>Status</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id}><td className="whitespace-nowrap">{new Date(h.createdAt).toLocaleString()}</td><td>{h.ip ?? "-"}</td><td>{h.country ?? "-"}</td><td className="max-w-48 truncate" title={h.userAgent ?? ""}>{h.userAgent ?? "-"}</td><td>{h.success ? <Badge color="green">OK</Badge> : <Badge color="red">Failed</Badge>}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
