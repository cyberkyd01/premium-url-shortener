import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { apiDeleteLink, apiUpdateLink, loadLink } from "@/lib/api-links";
import { serializeLink } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const link = await loadLink(id, auth.user.id, auth.isAdmin);
  return apiOk({ data: serializeLink(link) });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const data = await apiUpdateLink(id, await readBody(req), auth.user.id, auth.isAdmin);
  return apiOk({ data });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const data = await apiDeleteLink(id, auth.user.id, auth.isAdmin);
  return apiOk({ data, message: "Link deleted" });
});
