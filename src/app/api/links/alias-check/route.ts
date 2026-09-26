import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAliasAvailable } from "@/lib/links";
import { isValidAlias } from "@/lib/utils";

/** Dashboard helper: GET /api/links/alias-check?alias=&domainId=&exclude= */
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const alias = (req.nextUrl.searchParams.get("alias") || "").trim();
  const domainId = req.nextUrl.searchParams.get("domainId") || null;
  const exclude = req.nextUrl.searchParams.get("exclude") || undefined;
  if (!alias || !isValidAlias(alias)) return NextResponse.json({ error: 0, available: false, reason: "invalid" });
  const available = await isAliasAvailable(alias, domainId, exclude);
  return NextResponse.json({ error: 0, available });
}
