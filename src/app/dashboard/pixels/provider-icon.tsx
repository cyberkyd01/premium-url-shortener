import { cn } from "@/lib/utils";

const STYLES: Record<string, { bg: string; text: string }> = {
  facebook: { bg: "#1877f2", text: "f" }, twitter: { bg: "#111827", text: "X" }, bing: { bg: "#008373", text: "B" }, "google-ads": { bg: "#4285f4", text: "G" },
  gtm: { bg: "#246fdb", text: "GTM" }, ga: { bg: "#f9ab00", text: "GA" }, snapchat: { bg: "#fffc00", text: "S" }, reddit: { bg: "#ff4500", text: "r" },
  quora: { bg: "#b92b27", text: "Q" }, pinterest: { bg: "#e60023", text: "P" }, tiktok: { bg: "#000000", text: "TT" }, linkedin: { bg: "#0a66c2", text: "in" },
  adroll: { bg: "#00aeef", text: "AR" }, hotjar: { bg: "#ff3c00", text: "hj" }, clarity: { bg: "#0078d4", text: "C" }, matomo: { bg: "#3152a0", text: "M" }, custom: { bg: "#64748b", text: "</>" },
};

export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const s = STYLES[provider] ?? STYLES.custom;
  const dark = provider === "snapchat";
  return <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold", className)} style={{ background: s.bg, color: dark ? "#111827" : "#ffffff" }}>{s.text}</span>;
}
