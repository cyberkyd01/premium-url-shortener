import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, paginated, readBody  } from "@/lib/api-helpers";
import { apiCreateLink, linkListQuery, listLinks } from "@/lib/api-links";
import { clientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/links?search=&order=date|clicks&campaign=&channel=&domain=&status=&page=&limit= */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "links.read");
  if ("error" in auth) return auth.error;
  const { pagination, ...q } = linkListQuery(req);
  const { data, total } = await listLinks(auth.user.id, q, pagination);
  return paginated(data, total, pagination);
});

/** POST /api/v1/links — create a short link (full createLink input). */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "links.write");
  if ("error" in auth) return auth.error;
  const body = await readBody(req);
  const data = await apiCreateLink(body, auth.user.id, auth.isAdmin, clientIp(req.headers));
  return apiOk({ data, id: data.id, alias: data.alias, short: data.short, url: data.url }, 201);
});
