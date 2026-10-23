import "server-only";
import type { EventSettings, LegalDocument, PaymentsMode, TicketTier } from "@/generated/prisma/client";
import { isValidGstin } from "@/lib/gst";
import type { PricingConfig } from "@/lib/pricing";
import { db, type Tx } from "./db";

export async function getSettings(client: Tx | typeof db = db): Promise<EventSettings> {
  const s = await client.eventSettings.findUnique({ where: { id: 1 } });
  if (!s) throw new Error("EventSettings row missing. Run the seed.");
  return s;
}

export function pricingConfig(s: EventSettings): PricingConfig {
  return {
    gstRateBps: s.gstRateBps,
    pricesIncludeGst: s.pricesIncludeGst,
    feeMode: s.feeMode,
    feeValue: s.feeValue,
    feeTaxable: s.feeTaxable,
  };
}

/* ---------- go-live gate ---------- */

export type GateItem = { key: string; label: string; ok: boolean };

export function goLiveChecklist(s: EventSettings, tiers: TicketTier[], legal: LegalDocument[]): GateItem[] {
  const approved = (kind: LegalDocument["kind"]) => legal.some((d) => d.kind === kind && d.approvedAt);
  return [
    { key: "legalName", label: "Organiser legal name", ok: !!s.organiserLegalName?.trim() },
    { key: "gstin", label: "Organiser GSTIN (valid format and checksum)", ok: !!s.organiserGstin && isValidGstin(s.organiserGstin) },
    { key: "state", label: "GST state code", ok: !!s.organiserStateCode && /^\d{2}$/.test(s.organiserStateCode) },
    { key: "sac", label: "SAC code", ok: !!s.sacCode && /^\d{6}$/.test(s.sacCode) },
    { key: "privacy", label: "Privacy Policy marked approved", ok: approved("PRIVACY") },
    { key: "terms", label: "Terms and Conditions marked approved", ok: approved("TERMS") },
    { key: "refund", label: "Refund and Cancellation Policy marked approved", ok: approved("REFUND") },
    { key: "inclusions", label: "Inclusions set for every pass", ok: tiers.length > 0 && tiers.every((t) => t.inclusions.length > 0) },
    { key: "seats", label: "Seat split confirmed", ok: s.capacityConfirmed },
  ];
}

export async function loadGoLiveChecklist(client: Tx | typeof db = db) {
  const [s, tiers, legal] = await Promise.all([
    getSettings(client),
    client.ticketTier.findMany(),
    client.legalDocument.findMany(),
  ]);
  return goLiveChecklist(s, tiers, legal);
}

export class GoLiveBlocked extends Error {
  constructor(public missing: GateItem[]) {
    super(`Live payments are blocked until: ${missing.map((m) => m.label).join(", ")}`);
  }
}

/**
 * The mode new bookings are created in. LIVE only when the setting says LIVE *and* the
 * gate passes; otherwise sales stop rather than silently falling back to test keys.
 */
export async function activePaymentsMode(client: Tx | typeof db = db): Promise<PaymentsMode> {
  const s = await getSettings(client);
  if (s.paymentsMode === "TEST") return "TEST";
  const missing = (await loadGoLiveChecklist(client)).filter((i) => !i.ok);
  if (missing.length) throw new GoLiveBlocked(missing);
  return "LIVE";
}

/** Used by the admin (Phase 2). Refuses LIVE unless every checklist item passes. */
export async function setPaymentsMode(mode: PaymentsMode) {
  if (mode === "LIVE") {
    const missing = (await loadGoLiveChecklist()).filter((i) => !i.ok);
    if (missing.length) throw new GoLiveBlocked(missing);
  }
  await db.eventSettings.update({ where: { id: 1 }, data: { paymentsMode: mode } });
}
