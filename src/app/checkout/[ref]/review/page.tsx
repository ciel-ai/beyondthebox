import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Steps } from "@/components/forms";
import { Nav } from "@/components/Nav";
import { HoldTimer, PayButton } from "@/components/PayButton";
import { formatPaise, formatRate } from "@/lib/pricing";
import { hasBookingAccess } from "@/server/access";
import { decrypt, isBookingReference } from "@/server/crypto";
import { db } from "@/server/db";
import { getSiteData } from "@/server/content";

export const metadata: Metadata = { title: "Review and pay", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!isBookingReference(ref)) notFound();
  if (!(await hasBookingAccess(ref))) redirect("/booking/find");

  const [d, b] = await Promise.all([
    getSiteData(),
    db.booking.findUnique({
      where: { reference: ref },
      include: { tier: true, attendees: { orderBy: { position: "asc" } }, holds: { where: { releasedAt: null, convertedAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  if (!b) notFound();
  if (b.status !== "PENDING" && b.status !== "FAILED" && b.status !== "EXPIRED") redirect(`/booking/${ref}`);
  const hold = b.holds[0];

  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <Steps current={2} />
        <h1 className="display display-l mt-8">Review and pay</h1>
        <p className="meta mt-3 text-muted">
          Booking reference <span className="tnum text-white">{b.reference}</span>
        </p>

        <div className="grid-12 mt-12 gap-y-12">
          <section className="col-span-12 lg:col-span-7" aria-labelledby="att-title">
            <h2 id="att-title" className="display text-[32px]">
              {b.tier.name} × {b.quantity}
            </h2>
            <ul className="mt-6 border-t border-hairline">
              {b.attendees.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 border-b border-hairline py-4">
                  <span>{decrypt(a.nameEnc)}</span>
                  <span className="meta text-muted">Ticket {a.position}</span>
                </li>
              ))}
            </ul>
            <p className="meta mt-6 text-muted">
              {d.event.dateLabel} · {d.event.venueKnown ? d.event.venue : "Venue to be announced"}
            </p>
          </section>

          <aside className="col-span-12 lg:col-span-4 lg:col-start-9" aria-labelledby="pay-title">
            <div className="rounded-sm border border-hairline bg-surface p-6">
              <h2 id="pay-title" className="sr-only">Price breakdown</h2>
              {hold && b.status === "PENDING" && <HoldTimer expiresAt={hold.expiresAt.toISOString()} />}
              {b.status !== "PENDING" && <p className="ui text-gold-deep">Your previous hold ended. Paying now re-checks availability.</p>}
              <dl className="mt-5 space-y-3 text-[15px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Base price ({formatPaise(b.unitPricePaise, { whole: true })} × {b.quantity})</dt>
                  <dd className="tnum">{formatPaise(b.subtotalPaise)}</dd>
                </div>
                {b.discountPaise > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Discount</dt>
                    <dd className="tnum">− {formatPaise(b.discountPaise)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">GST ({formatRate(b.gstRateBps)}{b.pricesIncludeGst ? ", included" : ""})</dt>
                  <dd className="tnum">{formatPaise(b.taxPaise)}</dd>
                </div>
                {b.feePaise > 0 && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Convenience fee</dt>
                      <dd className="tnum">{formatPaise(b.feePaise)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">GST on fee</dt>
                      <dd className="tnum">{formatPaise(b.feeTaxPaise)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-4 border-t border-hairline pt-3 text-[20px] font-bold">
                  <dt>Total</dt>
                  <dd className="tnum text-gold-deep">{formatPaise(b.totalPaise)}</dd>
                </div>
              </dl>
              <div className="mt-6">
                <PayButton reference={b.reference} label={`Pay ${formatPaise(b.totalPaise)}`} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
