import "server-only";
import { cache } from "react";
import type { TierCode } from "@/generated/prisma/client";
import { db } from "./db";
import { eventDateLabel, venueLabel } from "./documents";
import { pricingConfig } from "./settings";

export type PublicTier = {
  code: TierCode;
  name: string;
  pricePaise: number;
  inclusions: string[];
  serial: string;
  available: number;
  salesOpen: boolean;
};

/** Everything the public pages need, read once per request. */
export const getSiteData = cache(async () => {
  const now = new Date();
  const [settings, tiers, held, speakers, agenda, faqs, awards, packages, sponsors] = await Promise.all([
    db.eventSettings.findUniqueOrThrow({ where: { id: 1 } }),
    db.ticketTier.findMany({ orderBy: { sortOrder: "asc" } }),
    db.seatHold.groupBy({
      by: ["tierId"],
      where: { releasedAt: null, convertedAt: null, expiresAt: { gt: now } },
      _sum: { quantity: true },
    }),
    db.speaker.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    db.agendaItem.findMany({ orderBy: { sortOrder: "asc" } }),
    db.faq.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    db.awardCategory.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    db.exhibitionPackage.findMany({ orderBy: { sortOrder: "asc" } }),
    db.sponsor.findMany({ where: { published: true }, orderBy: [{ tierOrder: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const heldBy = new Map(held.map((h) => [h.tierId, h._sum.quantity ?? 0]));
  const serials: Record<TierCode, string> = { STANDARD: "No. 001-S", PREMIUM: "No. 002-P", VIP: "No. 003-V" };

  return {
    event: {
      name: settings.name,
      subtitle: settings.subtitle,
      tagline: settings.tagline,
      startsAt: settings.startsAt,
      dateLabel: eventDateLabel(settings.startsAt),
      venue: venueLabel(settings.venueName),
      venueKnown: !!settings.venueName,
      capacity: settings.capacityTotal,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      maxTicketsPerOrder: settings.maxTicketsPerOrder,
      nominationsCloseAt: settings.nominationsCloseAt,
    },
    pricing: pricingConfig(settings),
    tiers: tiers.map<PublicTier>((t) => ({
      code: t.code,
      name: t.name,
      pricePaise: t.pricePaise,
      inclusions: t.inclusions,
      serial: serials[t.code],
      available: Math.max(0, t.capacity - t.soldCount - (heldBy.get(t.id) ?? 0)),
      salesOpen: t.salesOpen,
    })),
    speakers,
    agenda,
    faqs,
    awards,
    packages,
    sponsors,
  };
});

export type SiteData = Awaited<ReturnType<typeof getSiteData>>;
