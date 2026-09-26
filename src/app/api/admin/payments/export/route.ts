import { NextResponse, type NextRequest } from "next/server";
import { apiAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { csv } from "@/lib/admin/query";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!(await apiAdmin("payments.view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "", gateway = sp.get("gateway") ?? "", status = sp.get("status") ?? "", from = sp.get("from") ?? "", to = sp.get("to") ?? "";
  const where: Prisma.PaymentWhereInput = {
    ...(q ? { OR: [{ invoiceNumber: { contains: q } }, { transactionId: { contains: q } }, { user: { OR: [{ username: { contains: q } }, { email: { contains: q } }] } }] } : {}),
    ...(gateway ? { gateway } : {}), ...(status ? { status } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
  };
  const rows = await db.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: 10000, include: { user: { select: { username: true, email: true } }, plan: { select: { name: true } } } });
  const body = csv(rows.map((p) => ({ invoice: p.invoiceNumber ?? "", date: p.createdAt, user: p.user.username, email: p.user.email, plan: p.plan?.name ?? "", interval: p.interval, gateway: p.gateway, transaction: p.transactionId ?? "", amount: p.amount, tax: p.tax, discount: p.discount, currency: p.currency, coupon: p.couponCode ?? "", status: p.status })));
  return new NextResponse(body, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
