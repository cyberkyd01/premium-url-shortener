"use server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { str } from "@/lib/forms";
import { rateLimit } from "@/lib/api-auth";
import type { ActionState } from "@/components/ui/form-state";
import { shareCookieName, shareCookieValue } from "./token";

/** Verifies the report password and sets a signed cookie for 7 days. */
export async function unlockSharedReport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const token = str(fd, "token", 80);
  const password = str(fd, "password", 100);
  const report = await db.sharedReport.findUnique({ where: { token }, select: { id: true, password: true } });
  if (!report || !report.password) return { error: "Report not found" };
  if (!rateLimit("share:" + report.id, 10, 5 * 60_000).ok) return { error: "Too many attempts, try again in a few minutes" };
  if (!password || !(await bcrypt.compare(password, report.password))) return { error: "Incorrect password" };
  const store = await cookies();
  store.set(shareCookieName(report.id), shareCookieValue(report.id, report.password), { httpOnly: true, sameSite: "lax", path: "/share", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production" });
  return { ok: true };
}
