export function statusColor(s: string): "green" | "red" | "yellow" | "gray" | "blue" { return s === "open" ? "blue" : s === "pending" ? "yellow" : s === "resolved" ? "green" : "gray"; }
export function priorityColor(p: string): "green" | "red" | "yellow" | "gray" | "blue" { return p === "urgent" ? "red" : p === "high" ? "yellow" : p === "medium" ? "blue" : "gray"; }
