/**
 * Seed data. Idempotent: safe to run repeatedly.
 * Every value not in the organiser's brief is a [bracketed] placeholder.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { LEGAL_TEMPLATES } from "./legal-templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  await db.eventSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Beyond the Limits",
      subtitle: "A Business Conclave 2026",
      tagline: "Where ambition meets opportunity.",
      // 20 December 2026 (IST). Start time not announced; only the date is displayed.
      startsAt: new Date("2026-12-20T00:00:00+05:30"),
      venueName: null, // "To be announced"
      capacityTotal: 1000,
      capacityConfirmed: false,
      maxTicketsPerOrder: 10,
      holdMinutes: 15,
      gstRateBps: 1800, // DEFAULT, confirm with accountant
      pricesIncludeGst: false, // DEFAULT, confirm with accountant
      taxConfirmed: false,
      feeMode: "NONE",
      paymentsMode: "TEST",
    },
  });

  // PLACEHOLDER seat split (600 / 300 / 100). Not confirmed by the organiser; editable in the
  // admin, and the go-live gate stays closed until `capacityConfirmed` is set.
  const tiers = [
    { code: "STANDARD", name: "Standard Pass", pricePaise: 299_900, capacity: 600, sortOrder: 1, serialPrefix: "BTL26-S" },
    { code: "PREMIUM", name: "Premium Pass", pricePaise: 499_900, capacity: 300, sortOrder: 2, serialPrefix: "BTL26-P" },
    { code: "VIP", name: "VIP Pass", pricePaise: 699_900, capacity: 100, sortOrder: 3, serialPrefix: "BTL26-V" },
  ] as const;
  for (const t of tiers) {
    await db.ticketTier.upsert({
      where: { code: t.code },
      update: {},
      // Inclusions pending approval: empty → "[Inclusions to be confirmed]" on the site.
      create: { ...t, inclusions: [] },
    });
  }

  await db.speaker.upsert({
    where: { slug: "abdul-nabeel" },
    update: {},
    create: {
      slug: "abdul-nabeel",
      name: "Abdul Nabeel",
      role: "[Title, Company]",
      bio: null, // never invent bios
      sessionTitle: "[Session title]",
      sessionTime: "[Time]",
      sortOrder: 1,
    },
  });

  if ((await db.agendaItem.count()) === 0) {
    await db.agendaItem.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({ time: "[Time]", title: "[Session]", sortOrder: i + 1 })),
    });
  }

  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({
      data: [
        { sortOrder: 1, question: "When and where is the conclave?", answer: "20 December 2026. The venue will be announced soon." },
        { sortOrder: 2, question: "What's included in each pass?", answer: "[Inclusions to be confirmed]" },
        { sortOrder: 3, question: "Do I need to print my ticket?", answer: "No. Show the QR code on your phone at the entrance. Each attendee gets their own ticket, and each ticket can be scanned once." },
        { sortOrder: 4, question: "Can I book for my team and get a GST invoice?", answer: "Yes. Add your company name and GSTIN at checkout. A GST invoice is attached to your confirmation email." },
        { sortOrder: 5, question: "How many tickets can I buy in one order?", answer: "Up to 10 per order." },
        { sortOrder: 6, question: "Can I cancel my booking?", answer: "You can request a cancellation from your booking page. Requests are reviewed under the Refund and Cancellation Policy. [Policy pending organiser approval]" },
        { sortOrder: 7, question: "I lost my confirmation email. What do I do?", answer: "Use Find my booking. Enter your email and booking reference and we'll email you a secure link." },
      ],
    });
  }

  if ((await db.awardCategory.count()) === 0) {
    await db.awardCategory.createMany({
      data: [1, 2, 3].map((n) => ({ name: "[Award category]", description: "[Category description]", eligibility: "[Eligibility criteria]", sortOrder: n })),
    });
  }

  if ((await db.exhibitionPackage.count()) === 0) {
    await db.exhibitionPackage.createMany({
      data: [1, 2, 3].map((n) => ({ name: "[Package name]", description: "[What's included: stall size, branding, passes]", priceNote: "[Price on request]", sortOrder: n })),
    });
  }

  for (const doc of LEGAL_TEMPLATES) {
    await db.legalDocument.upsert({
      where: { kind_version: { kind: doc.kind, version: doc.version } },
      update: {},
      create: { ...doc, approvedAt: null },
    });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
