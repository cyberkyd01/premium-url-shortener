"use server";
import { headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { submitReport } from "@/lib/public-forms";
import type { ActionState } from "@/components/ui/form-state";

export async function sendReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const user = await currentUser();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  const r = await submitReport({
    target: String(formData.get("target") ?? ""), reason: String(formData.get("reason") ?? ""), details: String(formData.get("details") ?? ""),
    email: String(formData.get("email") ?? ""), userId: user?.id ?? null, ip,
  });
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
}
