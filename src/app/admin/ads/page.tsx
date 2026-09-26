import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { saveAds } from "./actions";

const SLOTS: { slot: string; label: string; hint: string }[] = [
  { slot: "header", label: "Header", hint: "Below the navigation on public pages" }, { slot: "footer", label: "Footer", hint: "Above the footer on public pages" },
  { slot: "sidebar", label: "Sidebar", hint: "Blog & help sidebar" }, { slot: "splash-top", label: "Splash page (top)", hint: "Above the countdown" },
  { slot: "splash-bottom", label: "Splash page (bottom)", hint: "Below the continue button" }, { slot: "bio", label: "Bio pages", hint: "Bottom of free-plan bio pages" }, { slot: "frame", label: "Frame redirect bar", hint: "Inside the frame top bar" },
];

export default async function AdsAdmin() {
  await adminPage("ads.manage");
  const [s, ads] = await Promise.all([getSettings(), db.ad.findMany()]);
  const bySlot = new Map(ads.map((a) => [a.slot, a]));
  return (
    <div>
      <PageHeader title="Advertisements" description="Paste ad network code (AdSense etc.) per slot. Premium plans with the 'No ads' feature never see ads." />
      <ActionForm action={saveAds} submitLabel="Save advertisements">
        <Card title="Global">
          <div className="grid md:grid-cols-2 gap-3">
            <SwitchField name="ads.enabled" label="Ads enabled" defaultChecked={s["ads.enabled"] === "1"} />
            <SwitchField name="ads.hideForPremium" label="Hide ads for premium users" defaultChecked={s["ads.hideForPremium"] === "1"} />
          </div>
        </Card>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {SLOTS.map(({ slot, label, hint }) => {
            const ad = bySlot.get(slot);
            return (
              <Card key={slot} title={label} description={hint} actions={<SwitchField name={`active.${slot}`} label="Active" defaultChecked={ad ? ad.active : true} />}>
                <Textarea name={`slot.${slot}`} defaultValue={ad?.code ?? ""} placeholder="<script>…</script>" className="font-mono text-xs" />
              </Card>
            );
          })}
        </div>
      </ActionForm>
    </div>
  );
}
