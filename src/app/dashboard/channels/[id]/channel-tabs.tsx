"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui";

export function ChannelTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [value, setValue] = useState(tabs[0]?.key ?? "");
  return (
    <div>
      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} value={value} onChange={setValue} />
      {tabs.find((t) => t.key === value)?.content}
    </div>
  );
}
