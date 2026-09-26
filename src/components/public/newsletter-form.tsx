"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function NewsletterForm({ source = "homepage" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ loading: boolean; message?: string; error?: string }>({ loading: false });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ loading: true });
    try {
      const r = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, source }) });
      const d = (await r.json()) as { error: number; message: string };
      setState(d.error ? { loading: false, error: d.message } : { loading: false, message: d.message });
      if (!d.error) setEmail("");
    } catch {
      setState({ loading: false, error: "Something went wrong. Please try again." });
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
      <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
      <button className="btn-primary whitespace-nowrap" disabled={state.loading}>{state.loading ? <Loader2 size={14} className="animate-spin" /> : "Subscribe"}</button>
      {state.error && <p className="text-danger text-sm sm:basis-full">{state.error}</p>}
      {state.message && <p className="text-success text-sm sm:basis-full">{state.message}</p>}
    </form>
  );
}
