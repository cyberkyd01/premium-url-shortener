import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { PublicQrGenerator } from "@/components/qr/public-generator";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: `Free QR code generator | ${s["site.name"]}`, description: "Create QR codes for URLs, Wi-Fi, vCards, events and more. Download as PNG or SVG for free." };
}

/** Public QR generator (settings qr.public). Everything renders client-side; nothing is stored. */
export default async function PublicQrGeneratorPage() {
  const s = await getSettings();
  if (s["qr.enabled"] !== "1" || s["qr.public"] !== "1") notFound();
  const user = await currentUser();
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8"><h1 className="text-3xl md:text-4xl font-bold">Free QR code generator</h1><p className="text-muted mt-2">Create a QR code for a link, Wi-Fi network, contact card, event and more. Download it as PNG or SVG.</p></div>
      <PublicQrGenerator loggedIn={!!user} siteName={s["site.name"]} />
    </div>
  );
}
