import { purgeExpired } from "@/lib/tempmail";

/** Deletes expired temporary mailboxes and their messages. Schedule every 5-15 minutes. */
export async function tempMailJob(): Promise<Record<string, unknown>> {
  return purgeExpired();
}
