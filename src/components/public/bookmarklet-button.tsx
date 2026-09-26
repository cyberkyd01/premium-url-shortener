"use client";
import { CopyButton } from "@/components/ui";

/** Draggable bookmarklet link; clicking it in place is prevented so users drag it to the bookmarks bar instead. */
export function BookmarkletButton({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={code} className="btn-primary" onClick={(e) => e.preventDefault()} draggable title="Drag me to your bookmarks bar">{label}</a>
      <CopyButton text={code} label="Copy code" />
    </div>
  );
}
