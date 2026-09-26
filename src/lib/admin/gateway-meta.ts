export interface GatewayField { key: string; label: string; secret?: boolean; hint?: string; type?: "text" | "textarea" }

/** Credential fields shown for each seeded gateway (merged with the payments module's configKeys at runtime). */
export const GATEWAY_FIELDS: Record<string, GatewayField[]> = {
  stripe: [{ key: "publishableKey", label: "Publishable key" }, { key: "secretKey", label: "Secret key", secret: true }, { key: "webhookSecret", label: "Webhook signing secret", secret: true }],
  paypal: [{ key: "clientId", label: "Client ID" }, { key: "clientSecret", label: "Client secret", secret: true }, { key: "webhookId", label: "Webhook ID" }],
  paddle: [{ key: "apiKey", label: "API key", secret: true }, { key: "clientToken", label: "Client-side token" }, { key: "webhookSecret", label: "Webhook secret", secret: true }],
  "paddle-classic": [{ key: "vendorId", label: "Vendor ID" }, { key: "apiKey", label: "API key (vendor auth code)", secret: true }, { key: "vendorAuthCode", label: "Vendor auth code", secret: true }, { key: "publicKey", label: "Public key", type: "textarea" }, { key: "monthlyPlanId", label: "Monthly plan ID" }, { key: "yearlyPlanId", label: "Yearly plan ID" }],
  paystack: [{ key: "publicKey", label: "Public key" }, { key: "secretKey", label: "Secret key", secret: true }],
  razorpay: [{ key: "keyId", label: "Key ID" }, { key: "keySecret", label: "Key secret", secret: true }, { key: "webhookSecret", label: "Webhook secret", secret: true }],
  mollie: [{ key: "apiKey", label: "API key", secret: true }],
  cryptocom: [{ key: "publishableKey", label: "Publishable key" }, { key: "secretKey", label: "Secret key", secret: true }, { key: "webhookSecret", label: "Webhook signature secret", secret: true }],
  coinpayments: [{ key: "merchantId", label: "Merchant ID" }, { key: "publicKey", label: "Public key" }, { key: "privateKey", label: "Private key", secret: true }, { key: "ipnSecret", label: "IPN secret", secret: true }],
  midtrans: [{ key: "clientKey", label: "Client key" }, { key: "serverKey", label: "Server key", secret: true }],
  lemonsqueezy: [{ key: "apiKey", label: "API key", secret: true }, { key: "storeId", label: "Store ID" }, { key: "monthlyProductId", label: "Monthly product/variant ID" }, { key: "yearlyProductId", label: "Yearly product/variant ID" }, { key: "variantMonthly", label: "Variant ID (monthly)" }, { key: "variantYearly", label: "Variant ID (yearly)" }, { key: "variantLifetime", label: "Variant ID (lifetime)" }, { key: "webhookSecret", label: "Webhook secret", secret: true }],
  iyzico: [{ key: "apiKey", label: "API key" }, { key: "secretKey", label: "Secret key", secret: true }],
  mercadopago: [{ key: "publicKey", label: "Public key" }, { key: "accessToken", label: "Access token", secret: true }, { key: "webhookSecret", label: "Webhook secret (x-signature)", secret: true, hint: "Optional: the secret shown when you create the webhook in MercadoPago → Your integrations → Webhooks." }],
  bank: [{ key: "instructions", label: "Bank transfer instructions (shown at checkout)", type: "textarea" }],
};

export const GATEWAY_DOCS: Record<string, string> = {
  stripe: "https://dashboard.stripe.com/apikeys", paypal: "https://developer.paypal.com/dashboard/applications", paddle: "https://vendors.paddle.com/authentication-v2",
  "paddle-classic": "https://vendors.paddle.com/authentication", paystack: "https://dashboard.paystack.com/#/settings/developer", razorpay: "https://dashboard.razorpay.com/app/keys",
  mollie: "https://my.mollie.com/dashboard/developers/api-keys", cryptocom: "https://merchant.crypto.com/developers/api_keys", coinpayments: "https://www.coinpayments.net/acct-api",
  midtrans: "https://dashboard.midtrans.com/settings/config_info", lemonsqueezy: "https://app.lemonsqueezy.com/settings/api", iyzico: "https://merchant.iyzipay.com/settings", mercadopago: "https://www.mercadopago.com/developers/panel/app", bank: "",
};
