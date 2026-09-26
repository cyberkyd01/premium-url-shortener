import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticate, apiHandler, corsPreflight, paginate, paginated  } from "@/lib/api-helpers";
import { serializeSplash } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/splash — the user's custom splash pages (use their id as `splash` when creating links). */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "splash.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const where = { userId: auth.user.id };
  const [rows, total] = await Promise.all([
    db.splashPage.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { _count: { select: { links: true } } } }),
    db.splashPage.count({ where }),
  ]);
  return paginated(rows.map(serializeSplash), total, p);
});
