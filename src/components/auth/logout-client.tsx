"use client";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function LogoutClient() {
  useEffect(() => { void signOut({ callbackUrl: "/" }); }, []);
  return <div className="flex items-center justify-center gap-2 py-16 text-muted"><Loader2 size={18} className="animate-spin" /> Signing you out...</div>;
}
