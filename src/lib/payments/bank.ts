/** Manual bank transfer. No credentials: instructions come from settings `payments.bankDetails`.
 *  Creates a pending Payment; an admin marks it paid (which calls applyPayment with paymentId). */
import { getSettings } from "@/lib/settings";
import { notifyAdmins } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";
import { GatewayError, type Gateway } from "./types";

export const bankGateway: Gateway = {
  slug: "bank",
  name: "Bank transfer",
  supportsSubscriptions: false,
  configKeys: [],
  async createCheckout(p) {
    const s = await getSettings();
    const details = s["payments.bankDetails"]?.trim();
    if (!details) throw new GatewayError("Bank transfer is not configured: add bank details in admin settings");
    await notifyAdmins("Bank transfer pending", `${p.user.username} chose bank transfer for ${p.plan.name} (${p.interval}) - ${formatMoney(p.amount, p.currency)}. Reference ${p.paymentId}.`, "/admin/payments?status=pending");
    return { pending: true, message: `Please transfer ${formatMoney(p.amount, p.currency)} using the following details and include reference ${p.paymentId}:\n\n${details}\n\nYour plan will be activated once we confirm the transfer.` };
  },
  async handleWebhook() { return [{ type: "ignored", note: "bank transfers have no webhook" }]; },
  async cancelSubscription() { /* nothing to cancel */ },
};
