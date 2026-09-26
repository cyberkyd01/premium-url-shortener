import { LinkTabs } from "./link-tabs";
export function TicketTabs({ active, open }: { active: string; open?: number }) {
  return <LinkTabs active={active} tabs={[{ key: "tickets", label: "Tickets", href: "/admin/tickets", badge: open }, { key: "saved", label: "Saved replies", href: "/admin/tickets/saved-replies" }, { key: "categories", label: "Categories", href: "/admin/tickets/categories" }, { key: "settings", label: "Settings", href: "/admin/tickets/settings" }]} />;
}
