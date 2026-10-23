import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/CheckoutForm";
import { Steps } from "@/components/forms";
import { Nav } from "@/components/Nav";
import { TIER_CODES, type TierCodeValue } from "@/lib/schemas";
import { getSiteData } from "@/server/content";

export const metadata: Metadata = { title: "Attendee details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DetailsPage({ searchParams }: { searchParams: Promise<{ tier?: string; qty?: string }> }) {
  const sp = await searchParams;
  const d = await getSiteData();
  const code = TIER_CODES.includes(sp.tier as TierCodeValue) ? (sp.tier as TierCodeValue) : null;
  const tier = d.tiers.find((t) => t.code === code);
  const qty = Number(sp.qty);
  if (!tier || !Number.isInteger(qty) || qty < 1 || qty > d.event.maxTicketsPerOrder) redirect("/#tickets");

  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <Steps current={1} />
        <h1 className="display display-l mt-8">Who&apos;s coming</h1>
        <div className="mt-12">
          {tier.available < qty || !tier.salesOpen ? (
            <p role="alert" className="text-[18px] text-gold-deep">
              {tier.available > 0 ? `Only ${tier.available} ${tier.name} seats are left.` : `${tier.name} is sold out.`}{" "}
              <a className="link-u" href="/#tickets">Choose again</a>
            </p>
          ) : (
            <CheckoutForm tier={{ code: tier.code, name: tier.name, pricePaise: tier.pricePaise }} qty={qty} pricing={d.pricing} />
          )}
        </div>
      </main>
    </>
  );
}
