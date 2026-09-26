import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

/** GET ?q= — proxies GIPHY search for the bio builder (requires login and settings bio.giphyKey). */
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const key = await getSetting("bio.giphyKey");
  if (!key) return NextResponse.json({ error: 1, message: "GIPHY is not configured by the administrator", gifs: [] });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const url = q ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg` : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = (await res.json()) as { data?: { id: string; title: string; images: { fixed_height: { url: string }; original: { url: string } } }[] };
    return NextResponse.json({ error: 0, gifs: (j.data ?? []).map((g) => ({ id: g.id, title: g.title, preview: g.images.fixed_height.url, url: g.images.original.url })) });
  } catch { return NextResponse.json({ error: 1, message: "GIPHY request failed", gifs: [] }); }
}
