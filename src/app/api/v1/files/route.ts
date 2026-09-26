import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authenticate, apiHandler, corsPreflight, paginate, paginated  } from "@/lib/api-helpers";
import { serializeFile } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/files?search=&page=&limit= — hosted files (File hosting plugin). */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "files.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const search = req.nextUrl.searchParams.get("search");
  const where: Prisma.HostedFileWhereInput = { userId: auth.user.id, ...(search ? { OR: [{ name: { contains: search } }, { alias: { contains: search } }] } : {}) };
  const [rows, total] = await Promise.all([
    db.hostedFile.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit }),
    db.hostedFile.count({ where }),
  ]);
  return paginated(rows.map(serializeFile), total, p, { storageUsed: auth.user.storageUsed, storageLimitMb: auth.plan?.limitStorageMb ?? 0 });
});
