import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { firstParam } from "@/lib/social";
import { ReportForm } from "@/components/public/report-form";

export const metadata: Metadata = { title: "Report abuse", description: "Report spam, phishing, malware or other abusive short links." };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">Report abuse</h1>
      <p className="text-muted mt-1 mb-6">We take abuse seriously. Links used for spam, phishing, malware or illegal content are removed and the responsible accounts are suspended.</p>
      <div className="card p-6"><ReportForm defaultTarget={firstParam(sp, "url") ?? firstParam(sp, "alias")} defaultEmail={user?.email} /></div>
    </div>
  );
}
