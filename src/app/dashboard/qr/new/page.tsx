import { redirect } from "next/navigation";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { withinLimit } from "@/lib/plan";
import { Alert, PageHeader } from "@/components/ui";
import { QrFormScreen } from "../form-loader";

export const metadata = { title: "New QR code" };

export default async function NewQrPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["qr.enabled"] !== "1") return <Alert type="warning">QR codes are currently disabled.</Alert>;
  if (!can(ws, "qr", "create")) return <Alert type="error">You do not have permission to create QR codes.</Alert>;
  const total = await withinLimit(ws.ownerId, "limitQrCodes");
  if (!total.ok) return <Alert type="warning">You reached the QR code limit of your plan ({total.limit}). Please upgrade to create more.</Alert>;
  const monthly = await withinLimit(ws.ownerId, "limitQrMonthly");
  if (!monthly.ok) return <Alert type="warning">You reached your monthly QR code limit ({monthly.limit}).</Alert>;
  return <div><PageHeader title="New QR code" description="Pick a type, fill in the content and design your code." /><QrFormScreen ws={ws} qr={null} /></div>;
}
