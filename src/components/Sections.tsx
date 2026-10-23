import Image from "next/image";
import Link from "next/link";
import type { SiteData } from "@/server/content";
import { CopyField } from "./CopyField";
import type { SpeakerCardData } from "./SpeakerCard";
import { SpeakerRow } from "./SpeakerRow";

/* ---------- About ---------- */

export function About({ event }: { event: SiteData["event"] }) {
  return (
    <section id="about" className="section-y border-t border-hairline" aria-labelledby="about-title">
      <div className="wrap grid-12 gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <h2 id="about-title" className="display display-l">
            {event.subtitle}
          </h2>
          <p className="mt-6 text-[20px] text-muted">{event.tagline}</p>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <p className="measure text-[19px] leading-relaxed text-white/90">
            [A short paragraph about the conclave: who it brings together, why it exists and what attendees leave with. To be supplied by the organiser.]
          </p>
          <dl className="mt-12 grid grid-cols-1 border-t border-hairline sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ["Date", event.dateLabel],
              ["Venue", event.venueKnown ? event.venue : "To be announced"],
              ["Attendees", event.capacity.toLocaleString("en-IN")],
            ].map(([k, v], i) => (
              <div key={k} className={`py-6 sm:pr-6 ${i > 0 ? "border-t border-hairline sm:border-l sm:border-t-0 sm:pl-6 lg:border-l-0 lg:border-t lg:pl-0 xl:border-l xl:border-t-0 xl:pl-6" : ""}`}>
                <dt className="meta text-muted">{k}</dt>
                <dd className="display tnum mt-2 text-[clamp(1.75rem,2.3vw,2.125rem)]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ---------- Speakers ---------- */

export function Speakers({ speakers }: { speakers: SiteData["speakers"] }) {
  const cards: SpeakerCardData[] = speakers.map((s) => ({
    tba: false,
    slug: s.slug,
    name: s.name,
    role: s.role,
    photoUrl: s.photoUrl,
    xUrl: s.xUrl,
    linkedinUrl: s.linkedinUrl,
    instagramUrl: s.instagramUrl,
  }));
  for (let n = cards.length + 1; cards.length < 6; n++) cards.push({ tba: true, name: `Speaker ${String(n).padStart(2, "0")}` });

  return (
    <section id="speakers" className="section-y overflow-hidden border-t border-hairline" aria-labelledby="speakers-title">
      <h2 id="speakers-title" className="display display-xl text-center">
        Speakers
      </h2>
      <div className="mt-12 md:mt-16">
        <SpeakerRow cards={cards} />
      </div>
      <div className="mt-12 flex justify-center">
        <Link href="/speakers" className="btn btn-leaf">
          See all speakers
        </Link>
      </div>
    </section>
  );
}

/* ---------- Programme ---------- */

const FORMATS = [
  { name: "Keynotes", text: "[One line on the keynote sessions.]" },
  { name: "Industry recognition awards", text: "[One line on the awards evening.]" },
  { name: "Networking", text: "[One line on networking formats.]" },
  { name: "Exhibitions", text: "[One line on the exhibition floor.]" },
  { name: "Entertainment", text: "[One line on the entertainment.]" },
];

export function Programme({ agenda }: { agenda: SiteData["agenda"] }) {
  return (
    <section id="programme" className="section-y border-t border-hairline" aria-labelledby="programme-title">
      <div className="wrap">
        <h2 id="programme-title" className="display display-l">
          Programme
        </h2>
        <ul className="mt-14 border-t border-hairline">
          {FORMATS.map((f) => (
            <li key={f.name} className="grid-12 items-baseline gap-y-2 border-b border-hairline py-7">
              <h3 className="display col-span-12 text-[clamp(2rem,4vw,3.25rem)] md:col-span-7">{f.name}</h3>
              <p className="col-span-12 text-muted md:col-span-5">{f.text}</p>
            </li>
          ))}
        </ul>

        <div className="grid-12 mt-24 gap-y-8">
          <div className="col-span-12 lg:col-span-4">
            <h3 className="display text-[40px]">The day</h3>
            <p className="meta mt-3 text-muted">Timings to be announced.</p>
          </div>
          <ol className="col-span-12 border-l border-hairline lg:col-span-8">
            {agenda.map((a) => (
              <li key={a.id} className="relative grid grid-cols-[96px_1fr] gap-6 py-5 pl-8">
                <span className="absolute -left-[5px] top-[30px] h-[9px] w-[9px] rounded-full bg-gold-deep" aria-hidden />
                <span className="tnum meta text-muted">{a.time}</span>
                <span className="text-[18px]">{a.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- Awards ---------- */

export function Awards({ awards, closesAt }: { awards: SiteData["awards"]; closesAt: Date | null }) {
  const open = closesAt ? closesAt > new Date() : false;
  return (
    <section id="awards" className="section-y border-t border-hairline" aria-labelledby="awards-title">
      <div className="wrap grid-12 gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <h2 id="awards-title" className="display display-l">
            Industry recognition awards
          </h2>
          <p className="mt-6 text-muted">
            {closesAt
              ? `Nominations close ${closesAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}.`
              : "Nomination dates to be announced."}
          </p>
          <div className="mt-8">
            {open ? (
              <Link href="/awards/nominate" className="btn btn-leaf">
                Nominate now
              </Link>
            ) : (
              <span className="btn btn-dark" aria-disabled="true">
                Nominations open soon
              </span>
            )}
          </div>
        </div>
        <ul className="col-span-12 border-t border-hairline lg:col-span-6 lg:col-start-7">
          {awards.map((a) => (
            <li key={a.id} className="border-b border-hairline py-6">
              <h3 className="text-[20px] font-semibold">{a.name}</h3>
              {a.description && <p className="mt-1 text-muted">{a.description}</p>}
              {a.eligibility && <p className="meta mt-2 text-muted">Eligibility: {a.eligibility}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Exhibition ---------- */

export function Exhibition({ packages, email }: { packages: SiteData["packages"]; email: string | null }) {
  return (
    <section id="exhibition" className="section-y border-t border-hairline" aria-labelledby="exhibition-title">
      <div className="wrap">
        <div className="grid-12 gap-y-6">
          <h2 id="exhibition-title" className="display display-l col-span-12 lg:col-span-8">
            Exhibit at the conclave
          </h2>
          <div className="col-span-12 self-end lg:col-span-4 lg:text-right">
            {email ? (
              <a href={`mailto:${email}?subject=${encodeURIComponent("Exhibition enquiry: Beyond the Limits 2026")}`} className="btn btn-leaf">
                Enquire to exhibit
              </a>
            ) : (
              <span className="btn btn-dark" aria-disabled="true">
                Enquire to exhibit
              </span>
            )}
          </div>
        </div>
        <ul className="mt-14 grid gap-px border border-hairline bg-hairline md:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id} className="bg-black p-8">
              <h3 className="display text-[32px]">{p.name}</h3>
              <p className="mt-3 text-muted">{p.description}</p>
              {p.priceNote && <p className="meta mt-6">{p.priceNote}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Sponsorship ---------- */

const SPONSOR_TIERS = ["[Title sponsor]", "[Platinum sponsor]", "[Gold sponsor]", "[Associate partner]"];

export function Sponsorship({ email, phone }: { email: string | null; phone: string | null }) {
  const subject = encodeURIComponent("Sponsorship enquiry: Beyond the Limits 2026");
  return (
    <section id="sponsors" className="section-y border-t border-hairline" aria-labelledby="sponsorship-title">
      <div className="wrap grid-12 gap-y-14">
        <div className="col-span-12 lg:col-span-6">
          <h2 id="sponsorship-title" className="display display-l">
            Become a sponsor
          </h2>
          <p className="measure mt-6 text-muted">[One paragraph on the audience and what sponsors get. To be supplied by the organiser.]</p>
          <ul className="mt-10 border-t border-hairline">
            {SPONSOR_TIERS.map((t) => (
              <li key={t} className="flex items-baseline justify-between gap-6 border-b border-hairline py-5">
                <span className="text-[20px] font-semibold">{t}</span>
                <span className="meta text-muted">[Benefits]</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <CopyField label="Email" value={email} href={email ? `mailto:${email}?subject=${subject}` : null} placeholder="[email]" />
          <CopyField label="Phone" value={phone} href={phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null} placeholder="[phone]" />
          <div className="mt-8 flex flex-wrap gap-3">
            {/* The sponsorship form arrives in Phase 3; until then this opens an email. */}
            {email ? (
              <>
                <a className="btn btn-leaf" href={`mailto:${email}?subject=${subject}`}>Become a sponsor</a>
                <a className="btn btn-dark" href={`mailto:${email}`}>Email us</a>
              </>
            ) : (
              <>
                <span className="btn btn-leaf" aria-disabled="true">Become a sponsor</span>
                <span className="btn btn-dark" aria-disabled="true">Email us</span>
              </>
            )}
            {phone ? (
              <a className="btn btn-dark" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Call us</a>
            ) : (
              <span className="btn btn-dark" aria-disabled="true">Call us</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Confirmed sponsor and partner logos by tier. Renders nothing until at least one is added. */
export function SponsorLogos({ sponsors }: { sponsors: SiteData["sponsors"] }) {
  if (!sponsors.length) return null;
  const tiers = [...new Set(sponsors.map((s) => s.tier))];
  return (
    <section className="section-y border-t border-hairline" aria-labelledby="partners-title">
      <div className="wrap">
        <h2 id="partners-title" className="display display-l">
          Sponsors &amp; partners
        </h2>
        {tiers.map((tier) => (
          <div key={tier} className="mt-14">
            <h3 className="ui text-muted">{tier}</h3>
            <ul className="mt-6 grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-4">
              {sponsors
                .filter((s) => s.tier === tier)
                .map((s) => (
                  <li key={s.id} className="relative flex aspect-[3/2] items-center justify-center bg-black p-8">
                    <a href={s.websiteUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full">
                      <Image src={s.logoUrl} alt={s.name} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-contain" />
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

export function Faq({ faqs }: { faqs: SiteData["faqs"] }) {
  return (
    <section id="faq" className="section-y border-t border-hairline" aria-labelledby="faq-title">
      <div className="wrap grid-12 gap-y-12">
        <h2 id="faq-title" className="display display-l col-span-12 lg:col-span-4">
          FAQ
        </h2>
        <div className="col-span-12 border-t border-hairline lg:col-span-8">
          {faqs.map((f) => (
            <details key={f.id} className="faq border-b border-hairline">
              <summary className="flex min-h-11 items-center justify-between gap-6 py-6 text-[clamp(1.125rem,1.6vw,1.375rem)] font-semibold">
                {f.question}
                <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} className="shrink-0" aria-hidden>
                  <path d="M1 8h14" />
                  <path className="faq-v" d="M8 1v14" />
                </svg>
              </summary>
              <p className="measure pb-7 pr-10 text-muted">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
