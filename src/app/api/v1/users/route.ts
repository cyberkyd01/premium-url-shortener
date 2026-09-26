import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asDate, asString, corsPreflight, paginate, paginated, readBody, requireString, ApiRequestError  } from "@/lib/api-helpers";
import { serializeUser } from "@/lib/api-serializers";
import { hashPassword } from "@/lib/auth";
import { generateApiKey, randomToken, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/users?search=&plan=&status=&page=&limit= — admin only. */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "users.read");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const q = req.nextUrl.searchParams;
  const p = paginate(req);
  const where: Prisma.UserWhereInput = {};
  const search = q.get("search");
  if (search) where.OR = [{ username: { contains: search } }, { email: { contains: search } }, { name: { contains: search } }];
  const plan = q.get("plan");
  if (plan) where.plan = { OR: [{ id: plan }, { slug: plan }] };
  const status = q.get("status");
  if (status) where.status = status === "active" ? 1 : status === "banned" ? 0 : status === "pending" ? 2 : parseInt(status, 10);
  if (q.get("role")) where.role = q.get("role") ?? undefined;
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { plan: true } }),
    db.user.count({ where }),
  ]);
  return paginated(rows.map((u) => serializeUser(u, { admin: true })), total, p);
});

/** POST /api/v1/users {username, email, password, planId?, planExpires?, role?, name?} — admin only. */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "users.write");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const body = await readBody(req);
  const email = requireString(body.email, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiRequestError("Invalid email");
  const password = requireString(body.password, "password");
  if (password.length < 6) throw new ApiRequestError("Password must be at least 6 characters");
  let username = slugify(asString(body.username) || email.split("@")[0]).replace(/-/g, "") || "user";
  if (asString(body.username) && username !== asString(body.username)?.toLowerCase()) throw new ApiRequestError("Username may only contain letters and numbers");
  if (await db.user.findUnique({ where: { email } })) throw new ApiRequestError("Email already registered", 409);
  if (await db.user.findUnique({ where: { username } })) {
    if (asString(body.username)) throw new ApiRequestError("Username already taken", 409);
    username = `${username}${randomToken(2)}`;
  }
  let planId: string | null = null;
  const planRef = asString(body.planId ?? body.plan);
  if (planRef) {
    const plan = await db.plan.findFirst({ where: { OR: [{ id: planRef }, { slug: planRef }] } });
    if (!plan) throw new ApiRequestError("Plan not found", 404);
    planId = plan.id;
  } else planId = (await db.plan.findFirst({ where: { isFree: true } }))?.id ?? null;
  const role = asString(body.role) ?? "user";
  if (!["user", "admin"].includes(role) && !(await db.role.findUnique({ where: { slug: role } }))) throw new ApiRequestError("Invalid role");
  const user = await db.user.create({
    data: {
      username, email, password: await hashPassword(password), name: asString(body.name)?.slice(0, 100) || null, role, planId,
      planExpires: asDate(body.planExpires ?? body.expires) ?? null, status: 1, emailVerified: new Date(), apiKey: generateApiKey(), affiliateCode: randomToken(4),
    },
    include: { plan: true },
  });
  return apiOk({ data: { ...serializeUser(user, { admin: true }), apiKey: user.apiKey } }, 201);
});
