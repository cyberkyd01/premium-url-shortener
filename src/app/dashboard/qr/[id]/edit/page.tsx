import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { Alert, PageHeader } from "@/components/ui";
import { QrFormScreen } from "../../form-loader";

export const metadata = { title: "Edit QR code" };

export default async function EditQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "qr", "edit")) return <Alert type="error">You do not have permission to edit QR codes.</Alert>;
  const qr = await db.qrCode.findFirst({ where: { id, userId: ws.ownerId } });
  if (!qr) notFound();
  return <div><PageHeader title={`Edit: ${qr.name}`} description={qr.isDynamic ? "Dynamic code – changing the content updates the destination without reprinting." : "Static code – changing the content changes the printed pattern."} /><QrFormScreen ws={ws} qr={qr} /></div>;
}
