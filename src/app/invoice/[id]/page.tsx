import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMoney, json } from "@/lib/utils";
import type { BillingInfo } from "@/lib/payments";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

/** Printable invoice. Visible to the payment owner and admins. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  if (!u) redirect(`/login?next=/invoice/${id}`);
  const p = await db.payment.findUnique({ where: { id }, include: { plan: true, user: true } });
  if (!p || (p.userId !== u.id && u.role !== "admin")) notFound();
  const s = await getSettings();
  const b = json<BillingInfo>(p.billingInfo, {});
  const subtotal = p.amount - p.tax + p.discount;
  const rows: [string, string][] = [["Invoice number", p.invoiceNumber ?? p.id], ["Date", formatDate(p.createdAt, true)], ["Status", p.status], ["Payment method", p.gateway], ...(p.transactionId ? [["Transaction", p.transactionId] as [string, string]] : [])];
  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", color: "#18181b", background: "#fff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            {s["site.logo"] ? <img src={s["site.logo"]} alt={s["site.name"]} style={{ height: 40, marginBottom: 8 }} /> : <h1 style={{ margin: 0, fontSize: 22 }}>{s["site.name"]}</h1>}
            <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>{s["site.email"]}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: 28, letterSpacing: 1 }}>INVOICE</h2>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600 }}>{p.invoiceNumber ?? p.id}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>{formatDate(p.createdAt)}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, textTransform: "uppercase", color: p.status === "completed" ? "#16a34a" : "#ca8a04" }}>{p.status === "completed" ? "Paid" : p.status}</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32, fontSize: 13 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", color: "#71717a" }}>Billed to</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{b.name || p.user.name || p.user.username}</p>
            <p style={{ margin: 0 }}>{p.user.email}</p>
            {b.address && <p style={{ margin: 0 }}>{b.address}</p>}
            {(b.city || b.zip) && <p style={{ margin: 0 }}>{[b.zip, b.city].filter(Boolean).join(" ")}</p>}
            {(b.state || b.country) && <p style={{ margin: 0 }}>{[b.state, b.country].filter(Boolean).join(", ")}</p>}
            {b.vat && <p style={{ margin: 0 }}>VAT: {b.vat}</p>}
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", color: "#71717a" }}>Details</p>
            {rows.map(([k, v]) => <p key={k} style={{ margin: 0 }}><span style={{ color: "#71717a" }}>{k}:</span> {v}</p>)}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "#f4f4f5" }}><th style={{ textAlign: "left", padding: "10px 12px" }}>Description</th><th style={{ textAlign: "right", padding: "10px 12px" }}>Amount</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: "10px 12px", borderBottom: "1px solid #e4e4e7" }}>{p.plan?.name ?? "Plan"} plan — {p.interval}{p.couponCode ? ` (coupon ${p.couponCode})` : ""}</td><td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e4e4e7" }}>{formatMoney(subtotal, p.currency)}</td></tr>
            {p.discount > 0 && <tr><td style={{ padding: "8px 12px", color: "#71717a" }}>Discount</td><td style={{ padding: "8px 12px", textAlign: "right" }}>-{formatMoney(p.discount, p.currency)}</td></tr>}
            {p.tax > 0 && <tr><td style={{ padding: "8px 12px", color: "#71717a" }}>Tax</td><td style={{ padding: "8px 12px", textAlign: "right" }}>{formatMoney(p.tax, p.currency)}</td></tr>}
            <tr><td style={{ padding: "12px", fontWeight: 700, borderTop: "2px solid #18181b" }}>Total</td><td style={{ padding: "12px", textAlign: "right", fontWeight: 700, borderTop: "2px solid #18181b" }}>{formatMoney(p.amount, p.currency)}</td></tr>
          </tbody>
        </table>
        {s["payments.invoiceFooter"] && <p style={{ marginTop: 32, fontSize: 12, color: "#71717a", whiteSpace: "pre-wrap" }}>{s["payments.invoiceFooter"]}</p>}
        <p style={{ marginTop: 24, fontSize: 12, color: "#71717a" }}>Thank you for your business.</p>
      </div>
      <div style={{ position: "fixed", top: 12, right: 12 }} className="no-print"><a href="#" id="print" style={{ fontSize: 13, padding: "8px 14px", background: "#18181b", color: "#fff", borderRadius: 8, textDecoration: "none" }}>Print / Save PDF</a></div>
      <style>{`@media print { .no-print { display: none } } body { -webkit-print-color-adjust: exact }`}</style>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print').addEventListener('click',function(e){e.preventDefault();window.print()});` }} />
    </div>
  );
}
