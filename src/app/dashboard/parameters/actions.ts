"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import type { ActionState } from "@/components/ui/form-state";

async function guard() {
  const ws = await getWorkspace();
  if (!ws) throw new Error("Please login");
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.parameterTemplates) throw new Error("Parameter templates are not available on your plan");
  return ws;
}

function parseParams(fd: FormData) {
  const params: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) { const v = String(fd.get("utm_" + k) ?? "").trim(); if (v) params["utm_" + k] = v; }
  const keys = fd.getAll("ckey").map(String); const vals = fd.getAll("cval").map(String);
  keys.forEach((k, i) => { const key = k.trim(); const val = (vals[i] ?? "").trim(); if (key && val && !/^utm_/.test(key)) params[key] = val; });
  return params;
}

export async function saveTemplate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ws = await guard();
    const id = String(fd.get("id") ?? "");
    const name = String(fd.get("name") ?? "").trim().slice(0, 100);
    if (!name) return { error: "Name is required" };
    const params = parseParams(fd);
    if (!Object.keys(params).length) return { error: "Add at least one parameter" };
    if (id) {
      const t = await db.parameterTemplate.findFirst({ where: { id, userId: ws.ownerId } });
      if (!t) return { error: "Template not found" };
      await db.parameterTemplate.update({ where: { id }, data: { name, params: JSON.stringify(params) } });
    } else {
      await db.parameterTemplate.create({ data: { userId: ws.ownerId, name, params: JSON.stringify(params) } });
    }
    revalidatePath("/dashboard/parameters");
    return { ok: true, message: id ? "Template updated" : "Template created" };
  } catch (e) { return { error: e instanceof Error ? e.message : "Failed" }; }
}

export async function deleteTemplate(fd: FormData): Promise<void> {
  const ws = await guard().catch(() => null);
  if (!ws) return;
  const id = String(fd.get("id") ?? "");
  await db.parameterTemplate.deleteMany({ where: { id, userId: ws.ownerId } });
  revalidatePath("/dashboard/parameters");
}
