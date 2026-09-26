import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** PWA share target: the OS share sheet sends {url,text,title}; we forward the first URL found to the link editor. */
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const candidates = [sp.get("url"), sp.get("text"), sp.get("title")].filter((v): v is string => !!v);
  let url = "";
  for (const c of candidates) {
    const m = c.match(/https?:\/\/[^\s<>"']+/i);
    if (m) { url = m[0]; break; }
  }
  if (!url && candidates[0] && /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(candidates[0].trim())) url = candidates[0].trim();
  const target = new URL("/dashboard/links/new", req.nextUrl.origin);
  if (url) target.searchParams.set("url", url);
  const title = sp.get("title");
  if (title && sp.get("url")) target.searchParams.set("title", title.slice(0, 200));
  return NextResponse.redirect(target, 303);
}
