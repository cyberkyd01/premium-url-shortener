"use server";
import { headers } from "next/headers";
import { submitContact } from "@/lib/public-forms";
import type { ActionState } from "@/components/ui/form-state";

export async function sendContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  const r = await submitContact({
    name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""), captcha: String(formData.get("captcha") ?? ""), honeypot: String(formData.get("website") ?? ""), ip,
  });
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
}
