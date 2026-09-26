import { Badge } from "@/components/ui";

/** Status badge for a Domain's Cloudflare custom hostname (cfStatus / cfSslStatus). */
export function SslBadge({ status, ssl }: { status: string | null; ssl: string | null }) {
  if (!status) return <Badge>SSL not provisioned</Badge>;
  if (status === "error") return <Badge color="red">SSL error</Badge>;
  if (status === "active" && ssl === "active") return <Badge color="green">SSL active</Badge>;
  return <Badge color="yellow">SSL pending{ssl && ssl !== "pending" ? ` · ${ssl}` : ""}</Badge>;
}
