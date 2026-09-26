import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { storeFile } from "@/lib/storage";

export const runtime = "nodejs";

/** POST multipart: `file` (+ optional `folder`) → { url, path }. Requires login. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: true, message: "Unauthorized" }, { status: 401 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: true, message: "Invalid form data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: true, message: "No file uploaded" }, { status: 400 });
  const folderRaw = String(form.get("folder") ?? "uploads");
  const folder = /^[a-z0-9_-]{1,32}$/i.test(folderRaw) ? folderRaw : "uploads";
  try {
    const stored = await storeFile(file, folder);
    return NextResponse.json({ url: stored.url, path: stored.path, name: file.name, size: file.size, type: file.type });
  } catch (e) {
    return NextResponse.json({ error: true, message: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
