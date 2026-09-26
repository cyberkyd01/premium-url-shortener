import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-warning/15 text-warning grid place-items-center mb-4"><WifiOff size={22} /></div>
        <h1 className="text-2xl font-bold">You are offline</h1>
        <p className="text-muted mt-2">This page is not available without a connection. Check your network and try again; pages you visited recently may still work.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/dashboard" className="btn-primary">Retry</Link>
          <Link href="/" className="btn-secondary">Home</Link>
        </div>
      </div>
    </div>
  );
}
