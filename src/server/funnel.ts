import "server-only";
import type { FunnelStep } from "@/generated/prisma/client";
import { db, type Tx } from "./db";

/** Cookieless daily counters for the admin conversion chart. No personal data, no identifiers. */
export async function bumpFunnel(client: Tx | typeof db, step: FunnelStep, at = new Date()) {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  await client.$executeRaw`
    INSERT INTO "FunnelCount" (day, step, count) VALUES (${day}::date, ${step}::"FunnelStep", 1)
    ON CONFLICT (day, step) DO UPDATE SET count = "FunnelCount".count + 1`;
}
