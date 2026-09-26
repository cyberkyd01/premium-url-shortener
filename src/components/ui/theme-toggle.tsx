"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const d = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d); document.documentElement.classList.toggle("dark", d);
  }, []);
  return (
    <button type="button" aria-label="Toggle theme" className="btn-ghost btn-sm" onClick={() => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); }}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
