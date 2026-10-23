import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Faq } from "@/components/Sections";
import { Tickets } from "@/components/Tickets";
import { getSiteData } from "@/server/content";

export const metadata: Metadata = { title: "Tickets", description: "Standard, Premium and VIP passes for Beyond the Limits — A Business Conclave 2026.", alternates: { canonical: "/tickets" } };
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const d = await getSiteData();
  return (
    <>
      <Nav />
      <main id="main" className="pt-20">
        <h1 className="sr-only">Tickets for Beyond the Limits 2026</h1>
        <Tickets tiers={d.tiers} pricing={d.pricing} maxPerOrder={d.event.maxTicketsPerOrder} dateLabel={d.event.dateLabel} venue={d.event.venue} />
        <Faq faqs={d.faqs} />
      </main>
      <Footer />
    </>
  );
}
