import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, asDate, asNumber, asString, corsPreflight, readBody, ApiRequestError, type RouteCtx  } from "@/lib/api-helpers";
import { serializeUser } from "@/lib/api-serializers";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

async function loadUser(id: string) {
  const u = await db.user.findFirst({ where: { OR: [{ id }, { username: id }, { email: id.toLowerCase() }] }, include: { plan: true } });
  if (!u) throw new ApiRequestError("User not found", 404);
  return u;
}

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "users.read");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const { id } = await params;
  const u = await loadUser(id);
  const [links, bio, qr, payments] = await Promise.all([
    db.link.count({ where: { userId: u.id } }), db.bioPage.count({ where: { userId: u.id } }), db.qrCode.count({ where: { userId: u.id } }), db.payment.count({ where: { userId: u.id, status: "completed" } }),
  ]);
  return apiOk({ data: { ...serializeUser(u, { admin: true }), counts: { links, bio, qr, payments } } });
});

/** PUT /api/v1/users/:id {name?, email?, password?, planId?, planExpires?, role?, status?, verified?} — admin only. */
export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "users.write");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const { id } = await params;
  const u = await loadUser(id);
  const body = await readBody(req);
  const data: Prisma.UserUpdateInput = {};
  if ("name" in body) data.name = asString(body.name)?.slice(0, 100) || null;
  const email = asString(body.email)?.toLowerCase();
  if (email && email !== u.email) {
    if (await db.user.findUnique({ where: { email } })) throw new ApiRequestError("Email already registered", 409);
    data.email = email;
  }
  const password = asString(body.password);
  if (password) { if (password.length < 6) throw new ApiRequestError("Password must be at least 6 characters"); data.password = await hashPassword(password); }
  const planRef = asString(body.planId ?? body.plan);
  if (planRef !== undefined) {
    if (planRef) {
      const plan = await db.plan.findFirst({ where: { OR: [{ id: planRef }, { slug: planRef }] } });
      if (!plan) throw new ApiRequestError("Plan not found", 404);
      data.plan = { connect: { id: plan.id } };
    } else data.plan = { disconnect: true };
  }
  const expires = asDate(body.planExpires ?? body.expires);
  if (expires !== undefined) data.planExpires = expires;
  const role = asString(body.role);
  if (role) {
    if (!["user", "admin"].includes(role) && !(await db.role.findUnique({ where: { slug: role } }))) throw new ApiRequestError("Invalid role");
    if (u.id === auth.user.id && role !== "admin") throw new ApiRequestError("You cannot demote yourself");
    data.role = role;
  }
  const status = body.status;
  if (status !== undefined) {
    const n = typeof status === "string" && isNaN(Number(status)) ? { active: 1, banned: 0, pending: 2 }[status] : asNumber(status);
    if (n === undefined || ![0, 1, 2].includes(n)) throw new ApiRequestError("Invalid status (active|banned|pending)");
    if (u.id === auth.user.id && n !== 1) throw new ApiRequestError("You cannot ban yourself");
    data.status = n;
  }
  const verified = asBool(body.verified);
  if (verified !== undefined) data.verified = verified;
  const credits = asNumber(body.aiCredits);
  if (credits !== undefined) data.aiCredits = credits;
  const updated = await db.user.update({ where: { id: u.id }, data, include: { plan: true } });
  return apiOk({ data: serializeUser(updated, { admin: true }) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "users.write");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return apiError("Admin access required", 403);
  const { id } = await params;
  const u = await loadUser(id);
  if (u.id === auth.user.id) throw new ApiRequestError("You cannot delete your own account through the API");
  if (u.role === "admin") throw new ApiRequestError("Admin accounts cannot be deleted through the API", 403);
  await db.user.delete({ where: { id: u.id } });
  return apiOk({ data: { id: u.id, username: u.username }, message: "User deleted with all their data" });
});
