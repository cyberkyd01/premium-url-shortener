"use client";
import { useActionState, useState } from "react";
import { Card, Input, Select, Switch, Badge } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { updateProfile } from "./actions";

export function ProfileForm({ user, languages, settings, timezones }: {
  user: { name: string | null; username: string; email: string; avatar: string | null; gravatar: boolean; timezone: string; language: string; isPublic: boolean; postLoginRedirect: string | null; notifyEmail: boolean; verified: boolean; reportFrequency: string };
  languages: { code: string; name: string }[];
  settings: { gravatar: boolean; publicAccounts: boolean; emailVerification: boolean };
  timezones: string[];
}) {
  const [state, action] = useActionState(updateProfile, null);
  const [gravatar, setGravatar] = useState(user.gravatar);
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail);
  const [isPublic, setIsPublic] = useState(user.isPublic);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [preview, setPreview] = useState<string | null>(user.avatar);
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card title="Profile" description="Your public identity on this site.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" defaultValue={user.name ?? ""} placeholder="Your name" />
            <Input label="Username" name="username" defaultValue={user.username} required pattern="[A-Za-z0-9_.-]{3,32}" hint="Used for your bio page URL (/u/username)" />
            <Input label="Email" name="email" type="email" defaultValue={user.email} required hint={settings.emailVerification ? "Changing your email requires re-verification" : undefined} className="sm:col-span-2" />
            <Select label="Timezone" name="timezone" defaultValue={user.timezone}>{timezones.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
            <Select label="Language" name="language" defaultValue={user.language}>{languages.length ? languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>) : <option value="en">English</option>}</Select>
            <Input label="Redirect after login" name="postLoginRedirect" defaultValue={user.postLoginRedirect ?? ""} placeholder="/dashboard/links" hint="Path or URL to open after you log in" className="sm:col-span-2" />
          </div>
        </Card>
        <Card title="Preferences">
          <div className="space-y-4">
            <Switch label="Email notifications" hint="Receive emails about your account, links and payments" checked={notifyEmail} onChange={setNotifyEmail} name="notifyEmail" />
            {settings.publicAccounts && <Switch label="Public account" hint="Required to share public campaign link lists and public stats pages" checked={isPublic} onChange={setIsPublic} name="isPublic" />}
            {settings.gravatar && <Switch label="Use Gravatar" hint="Show the Gravatar linked to your email when no avatar is uploaded" checked={gravatar} onChange={setGravatar} name="gravatar" />}
            <Select label="Email reports" name="reportFrequency" defaultValue={user.reportFrequency} hint="Receive a digest of your clicks, top links and QR scans by email" className="sm:max-w-xs">
              <option value="none">Off</option>
              <option value="weekly">Weekly (every Monday)</option>
              <option value="monthly">Monthly (1st of the month)</option>
            </Select>
          </div>
        </Card>
        <FormMessage state={state} />
        <SubmitButton>Save changes</SubmitButton>
      </div>
      <div className="space-y-6">
        <Card title="Avatar">
          <div className="flex flex-col items-center gap-3">
            <div className="h-24 w-24 rounded-full bg-bg border border-border overflow-hidden flex items-center justify-center text-2xl font-bold text-muted">
              {preview && !removeAvatar ? <img src={preview} alt="" className="h-full w-full object-cover" /> : (user.name ?? user.username).charAt(0).toUpperCase()}
            </div>
            {user.verified && <Badge color="blue">Verified</Badge>}
            <input type="file" name="avatar" accept="image/*" className="text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPreview(URL.createObjectURL(f)); setRemoveAvatar(false); } }} />
            {user.avatar && <label className="text-xs text-muted flex items-center gap-2"><input type="checkbox" checked={removeAvatar} onChange={(e) => setRemoveAvatar(e.target.checked)} /> Remove current avatar</label>}
            <input type="hidden" name="removeAvatar" value={removeAvatar ? "1" : "0"} />
            <p className="hint text-center">JPG, PNG or GIF. Max size set by the administrator.</p>
          </div>
        </Card>
      </div>
    </form>
  );
}
