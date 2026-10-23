import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SpeakerCard } from "@/components/SpeakerCard";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.speaker.findFirst({ where: { slug, published: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await load((await params).slug);
  return s ? { title: s.name, description: `${s.name} at Beyond the Limits — A Business Conclave 2026.`, alternates: { canonical: `/speakers/${s.slug}` } } : {};
}

export default async function SpeakerPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = await load((await params).slug);
  if (!s) notFound();
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <Link href="/speakers" className="ui link-u inline-flex min-h-11 items-center text-muted">All speakers</Link>
        <div className="grid-12 mt-10 gap-y-12">
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <SpeakerCard s={{ tba: false, slug: s.slug, name: s.name, role: s.role, photoUrl: s.photoUrl, xUrl: s.xUrl, linkedinUrl: s.linkedinUrl, instagramUrl: s.instagramUrl }} sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-6 lg:col-start-7">
            <h1 className="display display-l">{s.name}</h1>
            <p className="mt-4 text-[18px] text-muted">{s.role}</p>
            <section className="mt-12 border-t border-hairline pt-6" aria-labelledby="bio">
              <h2 id="bio" className="ui text-muted">About</h2>
              <p className="measure mt-3 text-[18px]">{s.bio ?? "[Bio to be added]"}</p>
            </section>
            <section className="mt-10 border-t border-hairline pt-6" aria-labelledby="session">
              <h2 id="session" className="ui text-muted">Session</h2>
              <p className="mt-3 text-[18px]">{s.sessionTitle ?? "[Session title]"}</p>
              <p className="meta tnum mt-1 text-muted">{s.sessionTime ?? "[Time]"}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
