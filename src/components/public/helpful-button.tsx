"use client";
import { useEffect, useState, useTransition } from "react";
import { ThumbsUp } from "lucide-react";
import { markHelpful } from "@/app/(public)/help/actions";

export function HelpfulButton({ articleId, count }: { articleId: string; count: number }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const key = `helpful:${articleId}`;
  useEffect(() => { try { if (localStorage.getItem(key)) setDone(true); } catch { /* ignore */ } }, [key]);
  const already = done;
  return (
    <div className="card p-5 mt-10 flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium text-sm">Was this article helpful?</p>
      {already ? (
        <span className="text-sm text-success">Thanks for your feedback!</span>
      ) : (
        <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { const r = await markHelpful(articleId); if (r.ok) { setDone(true); try { localStorage.setItem(key, "1"); } catch { /* ignore */ } } })}>
          <ThumbsUp size={14} /> Yes{count > 0 && <span className="text-muted">({count})</span>}
        </button>
      )}
    </div>
  );
}
