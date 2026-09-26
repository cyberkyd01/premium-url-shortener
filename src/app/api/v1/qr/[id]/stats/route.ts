import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { loadQr } from "@/lib/api-resources";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/qr/:id/stats?days=30 — scans of a dynamic QR code. */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "qr.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const qr = await loadQr(id, auth.user.id, auth.isAdmin);
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const stats = await getStats({ qrCodeId: qr.id }, days);
  return apiOk({ data: { id: qr.id, name: qr.name, dynamic: qr.isDynamic, days, scans: qr.scans, ...stats } });
});
