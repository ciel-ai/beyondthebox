import "server-only";
import { decrypt } from "./crypto";
import { db } from "./db";
import { renderInvoicePdf } from "./pdf/invoice";
import { renderTicketPdf, type TicketPdfData } from "./pdf/ticket";
import { getSettings } from "./settings";

export function eventDateLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function venueLabel(venueName: string | null) {
  return venueName?.trim() || "To be announced";
}

/** One PDF per attendee ticket (attached individually to the confirmation email). */
export async function ticketPdfs(bookingId: string, ticketId?: string) {
  const settings = await getSettings();
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { tier: true, tickets: { where: { status: "VALID", ...(ticketId ? { id: ticketId } : {}) }, include: { attendee: true }, orderBy: { serial: "asc" } } },
  });
  return Promise.all(
    booking.tickets.map(async (t) => {
      const data: TicketPdfData = {
        ticketId: t.id,
        serial: t.serial,
        attendeeName: decrypt(t.attendee.nameEnc),
        tierName: booking.tier.name,
        reference: booking.reference,
        eventName: `${settings.name}: ${settings.subtitle}`,
        subtitle: settings.subtitle,
        dateLabel: eventDateLabel(settings.startsAt),
        venueLabel: venueLabel(settings.venueName),
        isTest: booking.paymentsMode !== "LIVE",
      };
      return { ticketId: t.id, serial: t.serial, filename: `BTL26-ticket-${t.serial}.pdf`, content: await renderTicketPdf([data]) };
    }),
  );
}

export async function invoicePdf(bookingId: string) {
  const settings = await getSettings();
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { tier: true, invoice: true } });
  const inv = booking.invoice;
  if (!inv) return null;
  const parties = JSON.parse(decrypt(inv.partiesEnc));
  const content = await renderInvoicePdf({
    number: inv.number,
    issuedAt: inv.issuedAt,
    isTest: inv.isTest,
    taxConfirmed: settings.taxConfirmed,
    seller: parties.seller,
    buyer: parties.buyer,
    line: { description: `Admission: ${booking.tier.name}, ${settings.name} (${eventDateLabel(settings.startsAt)})`, quantity: booking.quantity, unitPaise: booking.unitPricePaise },
    gstRateBps: booking.gstRateBps,
    discountPaise: booking.discountPaise,
    taxablePaise: inv.taxablePaise,
    cgstPaise: inv.cgstPaise,
    sgstPaise: inv.sgstPaise,
    igstPaise: inv.igstPaise,
    feePaise: inv.feePaise,
    feeTaxPaise: inv.feeTaxPaise,
    totalPaise: inv.totalPaise,
    reference: booking.reference,
  });
  return { filename: `${inv.number.replaceAll("/", "-")}.pdf`, content };
}
