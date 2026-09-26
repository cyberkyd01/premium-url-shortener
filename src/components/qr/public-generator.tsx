"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { QR_TYPES, encodeQrData, DEFAULT_QR_STYLE, normalizeQrStyle, type QrStyle } from "@/lib/qr-types";
import { QrPreview, QrStyleEditor, downloadClientQr } from "./qr-designer";
import { QrTypeFields } from "./qr-form";

const PUBLIC_TYPES = ["url", "text", "email", "phone", "sms", "wifi", "vcard", "location", "event", "whatsapp"];

/** Client-only public QR generator: nothing is stored; registering unlocks saving, tracking and dynamic codes. */
export function PublicQrGenerator({ loggedIn, siteName }: { loggedIn: boolean; siteName: string }) {
  const [type, setType] = useState("url");
  const [data, setData] = useState<Record<string, string>>({});
  const [style, setStyle] = useState<QrStyle>(normalizeQrStyle(DEFAULT_QR_STYLE));
  const payload = useMemo(() => encodeQrData(type, data) || `https://${siteName.toLowerCase().replace(/\s+/g, "")}.example`, [type, data, siteName]);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      <div className="space-y-5">
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {QR_TYPES.filter((t) => PUBLIC_TYPES.includes(t.type)).map((t) => <button key={t.type} type="button" onClick={() => { setType(t.type); setData({}); }} className={cn("px-3 py-1.5 text-sm rounded-lg border", type === t.type ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-bg")}>{t.label}</button>)}
          </div>
          <QrTypeFields type={type} data={data} onChange={setData} uploads={false} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Style</h3>
          <QrStyleEditor style={style} onChange={setStyle} advanced basic />
        </div>
      </div>
      <div className="lg:sticky lg:top-24 self-start space-y-3">
        <div className="card p-5 flex flex-col items-center gap-3">
          <QrPreview data={payload} style={style} size={240} />
          <div className="flex gap-2 w-full">
            <button type="button" className="btn-primary flex-1" onClick={() => downloadClientQr(payload, style, "qr-code", "png")}><Download size={14} />PNG</button>
            <button type="button" className="btn-secondary flex-1" onClick={() => downloadClientQr(payload, style, "qr-code", "svg")}><Download size={14} />SVG</button>
          </div>
        </div>
        <div className="card p-5 bg-primary/5 border-primary/20">
          <p className="font-semibold flex items-center gap-2"><Sparkles size={16} className="text-primary" />Want more?</p>
          <p className="text-sm text-muted mt-1">Create a free account to save your QR codes, track scans by country and device, use dynamic codes you can edit later, add logos, frames and gradients.</p>
          <Link href={loggedIn ? "/dashboard/qr/new" : "/register"} className="btn-primary btn-sm mt-3">{loggedIn ? "Open the QR dashboard" : "Sign up free"}</Link>
        </div>
      </div>
    </div>
  );
}
