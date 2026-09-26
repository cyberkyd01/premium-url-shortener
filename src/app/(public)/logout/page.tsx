import type { Metadata } from "next";
import { LogoutClient } from "@/components/auth/logout-client";

export const metadata: Metadata = { title: "Logout" };

export default function LogoutPage() {
  return <LogoutClient />;
}
