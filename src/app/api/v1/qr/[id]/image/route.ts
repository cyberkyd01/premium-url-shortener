import { NextRequest, NextResponse } from "next/server";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { loadQr } from "@/lib/api-resources";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/qr/:id/image?format=svg|png — redirects to the renderer at /api/qr/:id/download. */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "qr.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const qr = await loadQr(id, auth.user.id, auth.isAdmin);
  const format = (req.nextUrl.searchParams.get("format") || "svg").toLowerCase();
  const size = req.nextUrl.searchParams.get("size");
  const q = new URLSearchParams({ format: ["svg", "png", "jpg", "jpeg", "webp", "pdf"].includes(format) ? format : "svg" });
  if (size) q.set("size", size);
  return NextResponse.redirect(appUrl(`/api/qr/${qr.id}/download?${q.toString()}`), 302);
});
