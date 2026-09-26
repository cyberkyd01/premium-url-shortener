"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Modal, Button, Input, Empty } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { addLinksToCampaign } from "@/app/dashboard/campaigns/actions";
import { Plus } from "lucide-react";

export interface SelectableLink { id: string; short: string; title: string | null; url: string; clicks: number }

export function AddLinksButton({ campaignId, links }: { campaignId: string; links: SelectableLink[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState(addLinksToCampaign, null);
  useEffect(() => { if (state?.ok) { setOpen(false); setSelected(new Set()); } }, [state]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return links;
    return links.filter((l) => l.short.toLowerCase().includes(s) || (l.title ?? "").toLowerCase().includes(s) || l.url.toLowerCase().includes(s));
  }, [links, q]);
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} />Add links</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add existing links" wide>
        {links.length === 0 ? (
          <Empty title="No links available" description="All of your links are already in this campaign, or you have not created any yet." />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaignId} />
            <div className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Search links..." value={q} onChange={(e) => setQ(e.target.value)} />
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(new Set(filtered.map((l) => l.id)))}>Select all</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
            <div className="max-h-80 overflow-auto border border-border rounded-lg divide-y divide-border">
              {filtered.map((l) => (
                <label key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-bg">
                  <input type="checkbox" name="linkIds" value={l.id} checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="accent-primary" />
                  <span className="flex-1 min-w-0"><span className="font-medium block truncate">{l.title || l.short}</span><span className="text-xs text-muted block truncate">{l.short} → {l.url}</span></span>
                  <span className="text-xs text-muted">{l.clicks} clicks</span>
                </label>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted p-4 text-center">No links match your search.</p>}
            </div>
            <FormMessage state={state} />
            <div className="flex items-center justify-between"><span className="text-sm text-muted">{selected.size} selected</span><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>Add to campaign</SubmitButton></div></div>
          </form>
        )}
      </Modal>
    </>
  );
}
