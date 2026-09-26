"use client";
import { useEffect, useState } from "react";
export function CookieConsent({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem("cookie-ok")); } catch { setShow(true); } }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 card p-4 flex items-center gap-3 animate-in">
      <p className="text-sm flex-1">{text}</p>
      <button className="btn-primary btn-sm" onClick={() => { try { localStorage.setItem("cookie-ok", "1"); } catch {} setShow(false); }}>OK</button>
    </div>
  );
}
