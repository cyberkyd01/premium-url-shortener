import { scanTrafficAlerts } from "@/lib/alerts";

/** Evaluates click thresholds and spike detection for links with recent traffic. Schedule every 10-15 minutes. */
export async function alertsJob(): Promise<Record<string, unknown>> {
  return scanTrafficAlerts();
}
