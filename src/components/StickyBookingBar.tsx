"use client";

import { useEffect, useState } from "react";

/**
 * Below 768px: a bottom "Book your pass" bar. Shows once the hero CTA has scrolled out of view,
 * and hides while the tickets section is on screen (so it never covers a ticket stub or a form button).
 */
export function StickyBookingBar() {
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [ticketsVisible, setTicketsVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const watch = (id: string, set: (v: boolean) => void, rootMargin = "0px") => {
      const el = document.getElementById(id);
      if (!el) return null;
      const io = new IntersectionObserver(([e]) => set(e!.isIntersecting), { rootMargin });
      io.observe(el);
      return io;
    };
    const observers = [watch("hero-cta", setHeroCtaVisible, "-80px 0px 0px 0px") /* under the fixed header counts as gone */, watch("tickets", setTicketsVisible), watch("contact", setFooterVisible)];
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  const show = !heroCtaVisible && !ticketsVisible && !footerVisible;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black px-[var(--gutter)] pt-3 transition-[transform,visibility] duration-200 md:hidden ${
        show ? "visible translate-y-0" : "pointer-events-none invisible translate-y-full"
      }`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-hidden={!show}
    >
      <a href="#tickets" className="btn btn-leaf w-full" tabIndex={show ? 0 : -1}>
        Book your pass
      </a>
    </div>
  );
}
