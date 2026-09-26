import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, paginate, paginated  } from "@/lib/api-helpers";
import { serializePayment } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/payments?user=&status=&gateway=&page=&limit= — admin only. */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "payments.read");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const q = req.nextUrl.searchParams;
  const p = paginate(req);
  const where: Prisma.PaymentWhereInput = {};
  const user = q.get("user");
  if (user) where.OR = [{ userId: user }, { user: { username: user } }, { user: { email: user } }];
  if (q.get("status")) where.status = q.get("status") ?? undefined;
  if (q.get("gateway")) where.gateway = q.get("gateway") ?? undefined;
  const [rows, total] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { user: { select: { id: true, username: true, email: true } }, plan: true } }),
    db.payment.count({ where }),
  ]);
  return paginated(rows.map(serializePayment), total, p);
});
