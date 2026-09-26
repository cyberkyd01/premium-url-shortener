"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface PaletteOption { key: string; label: string; description: string; swatch: string[] }

/** Color scheme picker: built-in palettes as swatches + "custom" revealing the primary/accent inputs. Submits `palette`, `primary`, `accent`. */
export function PaletteField({ schemes, defaultValue, primary, accent }: { schemes: PaletteOption[]; defaultValue: string; primary: string; accent: string }) {
  const [value, setValue] = useState(defaultValue);
  const options: PaletteOption[] = [...schemes, { key: "custom", label: "Custom", description: "Use your own primary and accent colors.", swatch: [primary, accent, "#0b1120"] }];
  return (
    <div>
      <label className="label">Color scheme</label>
      <input type="hidden" name="palette" value={value} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((o) => (
          <button key={o.key} type="button" onClick={() => setValue(o.key)} className={cn("rounded-lg border p-2 text-left transition", value === o.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted")} title={o.description}>
            <span className="flex gap-1 mb-1.5">{o.swatch.map((c, i) => <span key={i} className="h-5 flex-1 rounded" style={{ background: c }} />)}</span>
            <span className="flex items-center justify-between text-xs font-medium">{o.label}{value === o.key && <Check size={12} className="text-primary" />}</span>
          </button>
        ))}
      </div>
      <div className={cn("grid grid-cols-2 gap-3 mt-3", value !== "custom" && "hidden")}>
        <div><label className="label">Primary color</label><input className="input h-10" name="primary" type="color" defaultValue={primary} /></div>
        <div><label className="label">Accent color</label><input className="input h-10" name="accent" type="color" defaultValue={accent} /></div>
      </div>
      {value !== "custom" && <p className="hint">The {options.find((o) => o.key === value)?.label} scheme defines every color for light and dark mode.</p>}
    </div>
  );
}
