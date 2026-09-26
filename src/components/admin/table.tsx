import type { ReactNode } from "react";
import { Empty } from "@/components/ui";

/** Server-friendly table wrapper. Pass `<tr>` rows as children. */
export function Table({ head, children, empty = "Nothing here yet.", count }: { head: ReactNode[]; children?: ReactNode; empty?: string; count: number }) {
  return (
    <div className="card overflow-x-auto">
      {count === 0 ? <Empty title={empty} /> : (
        <table className="table">
          <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </div>
  );
}

export function StatusBadge({ value }: { value: string | number | boolean | null | undefined }) {
  const v = String(value ?? "").toLowerCase();
  const green = ["active", "completed", "approved", "paid", "resolved", "1", "true", "published", "done", "open"];
  const red = ["banned", "blocked", "failed", "rejected", "refunded", "0", "false", "cancelled", "expired", "closed"];
  const yellow = ["pending", "2", "disabled", "past_due", "trialing", "processing", "dismissed"];
  const color = green.includes(v) ? "green" : red.includes(v) ? "red" : yellow.includes(v) ? "yellow" : "gray";
  const label = v === "1" || v === "true" ? "Active" : v === "0" || v === "false" ? "Inactive" : v === "2" ? "Pending" : String(value ?? "-");
  return <span className={`badge-${color}`}>{label}</span>;
}

export function Ids({ id }: { id: string }) {
  return <input type="checkbox" name="ids" value={id} className="accent-primary" />;
}
