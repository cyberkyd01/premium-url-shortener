import { db } from "./db";
import { getSettings } from "./settings";
import { getUserPlan } from "./plan";
import { rateLimit } from "./api-auth";

/** AI Copilot: metered usage with monthly credits per plan and per-minute rate limits.
 *  Providers: OpenAI, Google Gemini, Anthropic Claude (plain HTTP, no SDK). */
export async function aiComplete(userId: string, feature: "slug" | "bio" | "insights", prompt: string, system = "You are a helpful marketing assistant.") {
  const s = await getSettings();
  if (s["ai.enabled"] !== "1") throw new Error("AI Copilot is disabled");
  if (!(s["ai.features"] || "").split(",").includes(feature)) throw new Error("This AI feature is disabled");
  const { user, plan, features } = await getUserPlan(userId);
  if (user.role !== "admin" && !features.aiCopilot) throw new Error("Your plan does not include AI Copilot");
  if (!rateLimit("ai:" + userId, parseInt(s["ai.rateLimit"] || "10", 10)).ok) throw new Error("Too many AI requests, slow down");
  const monthly = user.role === "admin" ? -1 : plan?.limitAiCredits ?? parseInt(s["ai.monthlyCredits"] || "0", 10);
  // reset credits monthly
  const resetAt = user.aiCreditsResetAt;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  if (!resetAt || resetAt < monthStart) await db.user.update({ where: { id: userId }, data: { aiCredits: 0, aiCreditsResetAt: new Date() } });
  const used = !resetAt || resetAt < monthStart ? 0 : user.aiCredits;
  if (monthly !== -1 && used >= monthly) throw new Error("Monthly AI credits exhausted");

  const provider = s["ai.provider"];
  let text = "";
  let tokens = 0;
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("Anthropic API key missing");
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: s["ai.model"] || "claude-sonnet-5", max_tokens: 1024, system, messages: [{ role: "user", content: prompt }] }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || "AI error");
    text = d.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? ""; tokens = (d.usage?.input_tokens ?? 0) + (d.usage?.output_tokens ?? 0);
  } else if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("Gemini API key missing");
    const model = s["ai.model"] || "gemini-2.0-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: prompt }] }] }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || "AI error");
    text = d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""; tokens = d.usageMetadata?.totalTokenCount ?? 0;
  } else {
    const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OpenAI API key missing");
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model: s["ai.model"] || "gpt-4o-mini", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || "AI error");
    text = d.choices?.[0]?.message?.content ?? ""; tokens = d.usage?.total_tokens ?? 0;
  }
  await db.$transaction([
    db.aiUsage.create({ data: { userId, feature, provider, tokens, credits: 1 } }),
    db.user.update({ where: { id: userId }, data: { aiCredits: { increment: 1 } } }),
  ]);
  return text.trim();
}
