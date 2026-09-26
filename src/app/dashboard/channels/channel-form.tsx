"use client";
import { useActionState, useEffect, useState } from "react";
import { Modal, Input, Switch, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { createChannel, updateChannel } from "./actions";
import { Plus, Pencil } from "lucide-react";

const PRESETS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b", "#111827"];

export function ChannelFormButton({ channel, disabled, disabledHint }: { channel?: { id: string; name: string; color: string; starred: boolean }; disabled?: boolean; disabledHint?: string }) {
  const [open, setOpen] = useState(false);
  const isEdit = !!channel;
  const [state, action] = useActionState(isEdit ? updateChannel : createChannel, null);
  const [colorValue, setColorValue] = useState(channel?.color ?? PRESETS[0]);
  const [starred, setStarred] = useState(channel?.starred ?? false);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Edit"><Pencil size={14} /></Button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? disabledHint : undefined}><Plus size={16} />New channel</Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit channel" : "New channel"}>
        <form action={action} className="space-y-4">
          {channel && <input type="hidden" name="id" value={channel.id} />}
          <Input label="Name" name="name" defaultValue={channel?.name} required maxLength={80} placeholder="e.g. Social media" />
          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => <button key={c} type="button" onClick={() => setColorValue(c)} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: colorValue === c ? "var(--fg)" : "transparent" }} aria-label={c} />)}
              <input type="color" value={colorValue} onChange={(e) => setColorValue(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent" />
            </div>
            <input type="hidden" name="color" value={colorValue} />
          </div>
          <Switch name="starred" label="Star this channel" hint="Starred channels are pinned in the sidebar." checked={starred} onChange={setStarred} />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>{isEdit ? "Save" : "Create"}</SubmitButton></div>
        </form>
      </Modal>
    </>
  );
}
