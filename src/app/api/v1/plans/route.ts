import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight  } from "@/lib/api-helpers";
import { serializePlan } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/plans — admin only: every plan with limits and features. */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "plans.read");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: true } } } });
  return apiOk({ data: plans.map((p) => ({ ...serializePlan(p), users: p._count.users })) });
});
