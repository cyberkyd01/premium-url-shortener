import { Input, Select, Textarea } from "@/components/ui";
import { SwitchField, UploadField } from "./fields";
import type { SettingField } from "@/lib/admin/settings-schema";

export type DynamicOptionMap = Record<"languages" | "plans" | "themes", { value: string; label: string }[]>;

/** Renders one setting according to its schema type. */
export function SettingInput({ field, value, dynamic }: { field: SettingField; value: string; dynamic: DynamicOptionMap }) {
  const { key, label, hint, placeholder } = field;
  switch (field.type) {
    case "switch": return <SwitchField name={key} label={label} hint={hint} defaultChecked={value === "1" || value === "true"} />;
    case "number": return <Input label={label} name={key} type="number" step="any" defaultValue={value} hint={hint} />;
    case "password": return <Input label={label} name={key} type="password" placeholder={value ? "•••••••• (saved, leave blank to keep)" : placeholder} hint={hint} autoComplete="new-password" />;
    case "textarea": return <Textarea label={label} name={key} defaultValue={value} hint={hint} />;
    case "code": return <Textarea label={label} name={key} defaultValue={value} hint={hint} className="[&_textarea]:font-mono [&_textarea]:text-xs" rows={6} />;
    case "upload": return <UploadField name={key} label={label} defaultValue={value} hint={hint} folder="site" accept="image/*" />;
    case "select": {
      const options = typeof field.options === "string" ? dynamic[field.options] : field.options ?? [];
      const has = options.some((o) => o.value === value);
      return <Select label={label} name={key} defaultValue={value} hint={hint}>{!has && <option value={value}>{value || "—"}</option>}{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    }
    default: return <Input label={label} name={key} defaultValue={value} hint={hint} placeholder={placeholder} />;
  }
}
