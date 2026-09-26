"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { saveTemplate } from "@/app/dashboard/parameters/actions";
import { splitTemplate } from "./params-builder";

const UTM = ["source", "medium", "campaign", "term", "content"];

export function TemplateForm({ template }: { template?: { id: string; name: string; params: Record<string, string> } }) {
  const [state, action] = useActionState(saveTemplate, null);
  const init = template ? splitTemplate(template.params) : { utm: {}, custom: {} };
  const [custom, setCustom] = useState<[string, string][]>(Object.entries(init.custom));
  return (
    <form action={action} className="space-y-4" key={template?.id ?? "new"}>
      {template && <input type="hidden" name="id" value={template.id} />}
      <div><label className="label">Template name</label><input name="name" className="input" defaultValue={template?.name ?? ""} placeholder="e.g. Newsletter campaign" required /></div>
      <div className="grid gap-3 sm:grid-cols-2">{UTM.map((k) => <div key={k}><label className="label">utm_{k}</label><input name={"utm_" + k} className="input" defaultValue={init.utm[k] ?? ""} /></div>)}</div>
      <div>
        <p className="label">Custom parameters</p>
        <div className="space-y-2">
          {custom.map(([k, v], i) => (
            <div key={i} className="grid gap-2 grid-cols-[1fr_1fr_auto]">
              <input name="ckey" className="input" placeholder="key" defaultValue={k} />
              <input name="cval" className="input" placeholder="value" defaultValue={v} />
              <button type="button" className="btn-ghost btn-sm !px-2 text-danger" onClick={() => setCustom(custom.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setCustom([...custom, ["", ""]])}>+ Add parameter</button>
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2"><SubmitButton>{template ? "Save template" : "Create template"}</SubmitButton>{template && <Link href="/dashboard/parameters" className="btn-ghost">Cancel</Link>}</div>
    </form>
  );
}
