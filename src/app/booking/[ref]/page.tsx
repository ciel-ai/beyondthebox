import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelRequest } from "@/components/BookingForms";
import { CheckIcon } from "@/components/brand";
import { Nav } from "@/components/Nav";
import { PayButton, StatusPoller } from "@/components/PayButton";
import { formatPaise } from "@/lib/pricing";
import { hasBookingAccess } from "@/server/access";
import { decrypt, isBookingReference } from "@/server/crypto";
import { db } from "@/server/db";
import { getSiteData } from "@/server/content";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };
export const dynamic = "force-dynamic";

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u!.slice(0, 2)}${"•".repeat(Math.max(1, u!.length - 2))}@${d}`;
}

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!isBookingReference(ref)) notFound();

  if (!(await hasBookingAccess(ref))) {
    // No status, names or emails without proof of access.
    return (
      <>
        <Nav />
        <main id="main" className="wrap pb-32 pt-36">
          <h1 className="display display-l">Find your booking</h1>
          <p className="mt-6 max-w-xl text-muted">For your privacy, open your booking from the link in your confirmation email, or ask for a new link.</p>
          <Link href="/booking/find" className="btn btn-leaf mt-8">Find my booking</Link>
        </main>
      </>
    );
  }

  const [d, b] = await Promise.all([
    getSiteData(),
    db.booking.findUnique({
      where: { reference: ref },
      include: {
        tier: true,
        invoice: { select: { number: true } },
        tickets: { include: { attendee: true }, orderBy: { serial: "asc" } },
        payments: { where: { decision: "CAPTURE" }, select: { id: true } },
        cancellations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);
  if (!b) notFound();

  const confirming = b.status === "PENDING" && b.payments.length > 0;
  const awaitingPayment = b.status === "PENDING" && !confirming;
  const cancel = b.cancellations[0];

  const STATUS: Record<string, { title: string; body: string }> = {
    CONFIRMED: { title: "You're in", body: `Your booking is confirmed. We've emailed the e-tickets to ${maskEmail(decrypt(b.buyerEmailEnc))}.` },
    FAILED: { title: "Payment didn't go through", body: "No money was taken. You can try again while seats are available." },
    EXPIRED: { title: "Your hold expired", body: "The 15-minute hold ended before payment. You can try again while seats are available." },
    CANCELLED: { title: "Booking cancelled", body: "This booking has been cancelled." },
    REFUND_PENDING: { title: "Refund in progress", body: "Your refund has been started. It usually arrives within 5–7 working days." },
    REFUNDED: { title: "Refunded", body: "This booking was refunded and its tickets are no longer valid." },
  };
  const s = confirming
    ? { title: "Confirming your payment", body: "This usually takes a few seconds. Keep this page open; it updates by itself." }
    : awaitingPayment
      ? { title: "Complete your payment", body: "Your seats are held for a short time. Finish paying to confirm the booking." }
      : STATUS[b.status]!;

  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        {confirming && <StatusPoller />}
        <p className="meta text-muted">
          Booking <span className="tnum text-white">{b.reference}</span>
        </p>
        <h1 className="display display-l mt-4" aria-live="polite">
          {s.title}
        </h1>
        <p className="mt-6 max-w-2xl text-[18px] text-white/85">{s.body}</p>

        <dl className="mt-10 grid max-w-3xl grid-cols-2 border-t border-hairline sm:grid-cols-4">
          {[
            ["Pass", b.tier.name],
            ["Tickets", String(b.quantity)],
            ["Total", formatPaise(b.totalPaise)],
            ["Date", d.event.dateLabel],
          ].map(([k, v]) => (
            <div key={k} className="border-b border-hairline py-4 pr-4">
              <dt className="meta text-muted">{k}</dt>
              <dd className="tnum mt-1 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        {awaitingPayment && (
          <div className="mt-10">
            <Link href={`/checkout/${b.reference}/review`} className="btn btn-leaf">Continue to payment</Link>
          </div>
        )}
        {(b.status === "FAILED" || b.status === "EXPIRED") && (
          <div className="mt-10 max-w-md rounded-sm border border-hairline bg-surface p-6">
            <PayButton reference={b.reference} label="Try payment again" />
          </div>
        )}

        {b.status === "CONFIRMED" && (
          <>
            <section className="mt-16" aria-labelledby="tickets-title">
              <h2 id="tickets-title" className="display text-[36px]">Tickets</h2>
              <ul className="mt-6 border-t border-hairline">
                {b.tickets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-4">
                    <div>
                      <p className="font-semibold">{decrypt(t.attendee.nameEnc)}</p>
                      <p className="meta tnum text-muted">
                        {t.serial} ·{" "}
                        {t.status === "VALID" ? (
                          <span className="inline-flex items-center gap-1 text-white">
                            <CheckIcon /> Valid
                          </span>
                        ) : (
                          t.status.toLowerCase()
                        )}
                      </p>
                    </div>
                    {t.status === "VALID" && (
                      <a href={`/api/tickets/${t.id}/pdf`} className="btn btn-dark btn-sm">
                        Download ticket
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {b.invoice && (
                <p className="mt-6">
                  <a href={`/api/bookings/${b.reference}/invoice`} className="link-u">
                    Download GST invoice {b.invoice.number}
                  </a>
                </p>
              )}
            </section>

            <section className="mt-16 max-w-2xl" aria-labelledby="cancel-title">
              <h2 id="cancel-title" className="display text-[36px]">Cancellation</h2>
              {cancel ? (
                <p className="mt-4 text-muted" role="status">
                  {cancel.status === "REQUESTED"
                    ? "We've received your cancellation request. We'll email you with the outcome."
                    : cancel.status === "APPROVED"
                      ? "Your cancellation was approved."
                      : "Your cancellation request was reviewed and not approved. We've emailed you the details."}
                </p>
              ) : (
                <div className="mt-4">
                  <p className="mb-5 text-muted">
                    You can ask to cancel under the{" "}
                    <Link href="/refund-policy" className="link-u">Refund and Cancellation Policy</Link>.
                  </p>
                  <CancelRequest reference={b.reference} />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
