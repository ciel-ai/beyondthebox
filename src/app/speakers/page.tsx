import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SpeakerCard } from "@/components/SpeakerCard";
import { getSiteData } from "@/server/content";

export const metadata: Metadata = { title: "Speakers", description: "Speakers at Beyond the Limits — A Business Conclave 2026.", alternates: { canonical: "/speakers" } };
export const dynamic = "force-dynamic";

export default async function SpeakersPage() {
  const { speakers } = await getSiteData();
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <h1 className="display display-xl">Speakers</h1>
        <p className="mt-6 text-muted">More speakers will be announced soon.</p>
        <ul className="mt-14 grid gap-x-[10px] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((s) => (
            <li key={s.id}>
              <SpeakerCard
                s={{ tba: false, slug: s.slug, name: s.name, role: s.role, photoUrl: s.photoUrl, xUrl: s.xUrl, linkedinUrl: s.linkedinUrl, instagramUrl: s.instagramUrl }}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
