import Link from "next/link";
import { getSiteData } from "@/server/content";
import { InstagramIcon, LinkedInIcon, SocialButton, XIcon, YouTubeIcon, type Social } from "./brand";
import { NAV_LINKS } from "@/lib/nav";

// [Social URLs]: add the organiser's profiles here (or in the admin from Phase 2).
const SOCIALS: Social[] = [
  { label: "Instagram", href: null, Icon: InstagramIcon },
  { label: "LinkedIn", href: null, Icon: LinkedInIcon },
  { label: "X", href: null, Icon: XIcon },
  { label: "YouTube", href: null, Icon: YouTubeIcon },
];

export async function Footer() {
  const { event } = await getSiteData();
  return (
    <footer id="contact" className="border-t border-gold-deep bg-black pb-10 pt-24" aria-labelledby="contact-title">
      <div className="wrap">
        <div className="grid-12 gap-y-14">
          <div className="col-span-12 lg:col-span-5">
            <h2 id="contact-title" className="display display-l">
              Contact
            </h2>
            <dl className="mt-8 space-y-5">
              <div>
                <dt className="meta text-muted">Email</dt>
                <dd className="mt-1 text-[22px]">
                  {event.contactEmail ? (
                    <a className="link-u" href={`mailto:${event.contactEmail}`}>
                      {event.contactEmail}
                    </a>
                  ) : (
                    "[email]"
                  )}
                </dd>
              </div>
              <div>
                <dt className="meta text-muted">Phone</dt>
                <dd className="tnum mt-1 text-[22px]">
                  {event.contactPhone ? (
                    <a className="link-u" href={`tel:${event.contactPhone.replace(/[^\d+]/g, "")}`}>
                      {event.contactPhone}
                    </a>
                  ) : (
                    "[phone]"
                  )}
                </dd>
              </div>
            </dl>
            <ul className="mt-8 flex flex-wrap gap-3" aria-label="Social media">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <SocialButton s={s} context="Beyond the Limits" />
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="col-span-12 grid grid-cols-2 gap-[var(--gutter)] md:col-span-8 lg:col-span-4 lg:col-start-7">
            <div>
              <h3 className="ui text-gold-deep">Event</h3>
              <ul className="mt-4">
                {NAV_LINKS.slice(0, 4).map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="flex min-h-11 items-center hover:text-gold-deep">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="ui text-gold-deep">Tickets</h3>
              <ul className="mt-4">
                <li>
                  <Link href="/#tickets" className="flex min-h-11 items-center hover:text-gold-deep">Book a pass</Link>
                </li>
                <li>
                  <Link href="/booking/find" className="flex min-h-11 items-center hover:text-gold-deep">Find my booking</Link>
                </li>
                <li>
                  <Link href="/#faq" className="flex min-h-11 items-center hover:text-gold-deep">FAQ</Link>
                </li>
              </ul>
            </div>
          </nav>

          <div className="col-span-12 md:col-span-4 lg:col-span-2">
            <h3 className="ui text-gold-deep">The conclave</h3>
            <p className="meta mt-4 text-muted">
              {event.subtitle}
              <br />
              {event.dateLabel}
            </p>
          </div>
        </div>

        {/* Large flat gold wordmark (decorative: the name is in the hero h1). */}
        {/* Sized by the container (the line is ~7.13em wide in Anton), so it always spans the column exactly. */}
        <div className="@container mt-20">
          <p aria-hidden className="display select-none whitespace-nowrap text-[13.8cqi] leading-[0.85] text-gold-deep">
            Beyond the Limits
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-hairline pt-6 text-[14px] text-muted md:flex-row md:items-center md:justify-between">
          <p>© 2026 [Organiser legal name]</p>
          <ul className="flex flex-wrap gap-x-6">
            <li>
              <Link href="/privacy" className="flex min-h-11 items-center hover:text-white">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms" className="flex min-h-11 items-center hover:text-white">Terms and Conditions</Link>
            </li>
            <li>
              <Link href="/refund-policy" className="flex min-h-11 items-center hover:text-white">Refund and Cancellation Policy</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
