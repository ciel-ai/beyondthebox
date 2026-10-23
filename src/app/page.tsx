import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { About, Awards, Exhibition, Faq, Programme, Speakers, SponsorLogos, Sponsorship } from "@/components/Sections";
import { Tickets } from "@/components/Tickets";
import { VisitBeacon } from "@/components/VisitBeacon";
import { getSiteData } from "@/server/content";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const d = await getSiteData();
  const url = process.env.APP_URL ?? "http://localhost:3000";

  // Schema.org Event. Venue is "To be announced" until set; offers come from the tier table.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BusinessEvent",
    name: `${d.event.name} — ${d.event.subtitle}`,
    description: `${d.event.tagline} Keynotes, industry recognition awards, networking, exhibitions and entertainment.`,
    startDate: "2026-12-20",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: d.event.venueKnown ? d.event.venue : "Venue to be announced", address: { "@type": "PostalAddress", addressCountry: "IN" } },
    image: [`${url}/opengraph-image`],
    performer: d.speakers.map((s) => ({ "@type": "Person", name: s.name })),
    maximumAttendeeCapacity: d.event.capacity,
    offers: d.tiers.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: (t.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability: t.available > 0 && t.salesOpen ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: `${url}/#tickets`,
    })),
    organizer: { "@type": "Organization", name: "[Organiser legal name]", url },
  };

  return (
    <>
      <Nav />
      <main id="main">
        <Hero dateLabel={d.event.dateLabel} venue={d.event.venue} />
        <About event={d.event} />
        <Speakers speakers={d.speakers} />
        <Programme agenda={d.agenda} />
        <Awards awards={d.awards} closesAt={d.event.nominationsCloseAt} />
        <Tickets tiers={d.tiers} pricing={d.pricing} maxPerOrder={d.event.maxTicketsPerOrder} dateLabel={d.event.dateLabel} venue={d.event.venue} />
        <Exhibition packages={d.packages} email={d.event.contactEmail} />
        <Sponsorship email={d.event.contactEmail} phone={d.event.contactPhone} />
        <SponsorLogos sponsors={d.sponsors} />
        <Faq faqs={d.faqs} />
      </main>
      <Footer />
      <VisitBeacon />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
