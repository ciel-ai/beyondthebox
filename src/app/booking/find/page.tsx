import type { Metadata } from "next";
import { FindBookingForm } from "@/components/BookingForms";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = { title: "Find my booking", alternates: { canonical: "/booking/find" } };

export default async function FindPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <h1 className="display display-l">Find my booking</h1>
        <p className="mt-6 max-w-xl text-muted">
          Enter the email you booked with and your booking reference. We&apos;ll email you a secure link to view your booking, download tickets again or request a cancellation.
        </p>
        <div className="mt-10">
          <FindBookingForm expired={link === "expired"} />
        </div>
      </main>
    </>
  );
}
