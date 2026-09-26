import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight  } from "@/lib/api-helpers";
import { serializeTeam } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/teams — teams the user owns and teams they are a member of. */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "teams.read");
  if ("error" in auth) return auth.error;
  const include = { owner: { select: { id: true, username: true, email: true } }, members: { include: { user: { select: { id: true, username: true, email: true } } } }, _count: { select: { members: true } } };
  const [owned, memberOf] = await Promise.all([
    db.team.findMany({ where: { ownerId: auth.user.id }, include, orderBy: { createdAt: "asc" } }),
    db.team.findMany({ where: { members: { some: { userId: auth.user.id } } }, include, orderBy: { createdAt: "asc" } }),
  ]);
  return apiOk({ data: { owned: owned.map((t) => serializeTeam(t, auth.user.id)), memberOf: memberOf.map((t) => serializeTeam(t, auth.user.id)), activeTeamId: auth.user.activeTeamId } });
});
