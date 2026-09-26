"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/form-state";
import { BIO_TEMPLATES, BIO_THEMES } from "@/lib/bio-widgets";
import { createBioFromTemplate } from "@/app/dashboard/bio/actions";

export function TemplatePicker({ dbTemplates, canUseDbTemplates, disabled }: { builtIns?: boolean; dbTemplates: { id: string; name: string; theme: string; avatar: string | null }[]; canUseDbTemplates: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState("blank");
  const [state, action] = useActionState(createBioFromTemplate, null);
  const preview = (theme: string) => BIO_THEMES.find((t) => t.key === theme)?.preview ?? "#f1f5f9";
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}><Plus size={16} />New bio page</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a bio page" wide>
        <form action={action} className="space-y-4">
          <input type="hidden" name="template" value={sel} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button type="button" onClick={() => setSel("blank")} className={"rounded-xl border p-3 text-left transition " + (sel === "blank" ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")}>
              <div className="h-20 rounded-lg bg-bg border border-dashed border-border grid place-items-center text-muted"><Plus size={20} /></div>
              <p className="font-medium text-sm mt-2">Blank</p><p className="text-xs text-muted">Start from scratch</p>
            </button>
            {BIO_TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => setSel(t.key)} className={"rounded-xl border p-3 text-left transition " + (sel === t.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")}>
                <div className="h-20 rounded-lg p-2 flex flex-col gap-1 items-center justify-center" style={{ background: preview(t.page.theme ?? "default") }}>
                  <span className="h-5 w-5 rounded-full bg-white/70" />{[0, 1].map((i) => <span key={i} className="h-2 w-3/4 rounded bg-white/60" />)}
                </div>
                <p className="font-medium text-sm mt-2">{t.name}</p><p className="text-xs text-muted line-clamp-2">{t.description}</p>
              </button>
            ))}
            {dbTemplates.map((t) => (
              <button key={t.id} type="button" disabled={!canUseDbTemplates} onClick={() => setSel("db:" + t.id)} className={"rounded-xl border p-3 text-left transition disabled:opacity-50 " + (sel === "db:" + t.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")}>
                <div className="h-20 rounded-lg grid place-items-center" style={{ background: preview(t.theme) }}>{t.avatar ? <img src={t.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-8 w-8 rounded-full bg-white/70" />}</div>
                <p className="font-medium text-sm mt-2">{t.name}</p><p className="text-xs text-muted">{canUseDbTemplates ? "Premium template" : "Upgrade to use"}</p>
              </button>
            ))}
          </div>
          <FormMessage state={state} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>Create page</SubmitButton></div>
        </form>
      </Modal>
    </>
  );
}
