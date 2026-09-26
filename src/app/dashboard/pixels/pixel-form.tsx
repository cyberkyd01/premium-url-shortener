"use client";
import { useActionState, useEffect, useState } from "react";
import { Modal, Input, Select, Textarea, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { PIXEL_PROVIDER_LIST } from "@/lib/pixel-providers";
import type { PixelProvider } from "@/lib/pixels";
import { createPixel, updatePixel } from "./actions";
import { Plus, Pencil } from "lucide-react";

export function PixelFormButton({ pixel, disabled, disabledHint }: { pixel?: { id: string; name: string; provider: string; pixelId: string }; disabled?: boolean; disabledHint?: string }) {
  const [open, setOpen] = useState(false);
  const isEdit = !!pixel;
  const [state, action] = useActionState(isEdit ? updatePixel : createPixel, null);
  const [provider, setProvider] = useState<PixelProvider>((pixel?.provider as PixelProvider | undefined) ?? "facebook");
  const def = PIXEL_PROVIDER_LIST.find((p) => p.key === provider) ?? PIXEL_PROVIDER_LIST[0];
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  return (
    <>
      {isEdit ? <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Edit"><Pencil size={14} /></Button> : <Button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? disabledHint : undefined}><Plus size={16} />New pixel</Button>}
      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? "Edit pixel" : "New pixel"}>
        <form action={action} className="space-y-4">
          {pixel && <input type="hidden" name="id" value={pixel.id} />}
          <Input label="Name" name="name" defaultValue={pixel?.name} required maxLength={80} placeholder="e.g. Meta – main account" />
          <Select label="Provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as PixelProvider)}>
            {PIXEL_PROVIDER_LIST.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Select>
          {provider === "custom" ? (
            <Textarea label={def.idLabel} name="pixelId" defaultValue={pixel?.provider === "custom" ? pixel.pixelId : ""} required hint={def.hint} placeholder="<script>...</script>" className="font-mono" />
          ) : (
            <Input label={def.idLabel} name="pixelId" defaultValue={pixel?.provider === provider ? pixel.pixelId : ""} required maxLength={300} hint={`${def.hint}, e.g. ${def.example}`} placeholder={def.example} />
          )}
          <FormMessage state={state} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>{isEdit ? "Save" : "Create"}</SubmitButton></div>
        </form>
      </Modal>
    </>
  );
}
