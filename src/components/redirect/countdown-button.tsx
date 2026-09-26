"use client";
import { useEffect, useState } from "react";

/** Countdown that reveals / enables the continue button and optionally auto-redirects. */
export function CountdownButton({ url, seconds, label = "Continue", color, textColor, autoRedirect = false, className }: {
  url: string; seconds: number; label?: string; color?: string; textColor?: string; autoRedirect?: boolean; className?: string;
}) {
  const [left, setLeft] = useState(Math.max(0, seconds));
  useEffect(() => {
    if (left <= 0) { if (autoRedirect) window.location.replace(url); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, autoRedirect, url]);
  const ready = left <= 0;
  return (
    <a href={ready ? url : undefined} aria-disabled={!ready} rel="noreferrer" onClick={(e) => { if (!ready) e.preventDefault(); }}
      className={"btn-primary w-full justify-center " + (ready ? "" : "opacity-60 cursor-not-allowed ") + (className ?? "")}
      style={color ? { background: color, color: textColor ?? "#fff" } : undefined}>
      {ready ? label : `${label} in ${left}s`}
    </a>
  );
}
