/**
 * Premium cron job functions. Registered with the runner in `src/lib/cron-runner.ts`
 * (e.g. `cronJobs["health"] = healthJob`) or call them from `scripts/cron.ts`.
 *
 * Suggested schedule: health every 15m, alerts every 10m, reports daily (early morning), webhook-retry every 5m.
 */
export { healthJob } from "./health";
export { alertsJob } from "./alerts";
export { reportsJob } from "./reports";
export { webhookRetryJob } from "./webhook-retry";

import { healthJob } from "./health";
import { alertsJob } from "./alerts";
import { reportsJob } from "./reports";
import { webhookRetryJob } from "./webhook-retry";

export const premiumCronJobs = {
  health: () => healthJob(),
  alerts: () => alertsJob(),
  reports: () => reportsJob(),
  "webhook-retry": () => webhookRetryJob(),
} as const;

export type PremiumCronJobName = keyof typeof premiumCronJobs;
