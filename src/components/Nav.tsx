"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NAV_LINKS } from "@/lib/nav";
import { useActiveSection } from "@/lib/useActiveSection";
import { Wordmark } from "./brand";


export function Nav() {
  const active = useActiveSection();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-black pt-[env(safe-area-inset-top)]">
      <div className="wrap flex h-[76px] items-center justify-between gap-6">
        <Link href="/" aria-label="Beyond the Limits: home" className="flex min-h-11 items-center">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active === l.href ? "location" : undefined}
                  className={`ui flex min-h-11 items-center transition-colors hover:text-gold-deep ${active === l.href ? "text-gold-deep" : "text-white/85"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/#tickets" className="btn btn-dark btn-sm hidden md:inline-flex">
            Book tickets
          </Link>
          <button
            ref={toggle}
            type="button"
            className="flex h-11 w-11 items-center justify-center lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              {open ? <path d="M5 5l14 14M19 5 5 19" /> : <path d="M3 8h18M3 16h18" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
          <div
            id="mobile-menu"
            className="fade-in fixed inset-x-0 bottom-0 top-[calc(77px+env(safe-area-inset-top))] overflow-y-auto bg-black lg:hidden"
          >
            <nav aria-label="Mobile" className="wrap flex min-h-full flex-col justify-between pb-10 pt-6">
              <ul>
                {NAV_LINKS.map((l, i) => (
                  <li key={l.href} className="border-b border-hairline">
                    <Link
                      ref={i === 0 ? first : undefined}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="display block py-4 text-[clamp(2.75rem,12vw,4.5rem)] hover:text-gold-deep"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/#tickets" onClick={() => setOpen(false)} className="btn btn-leaf mt-10 w-full">
                Book tickets
              </Link>
            </nav>
          </div>
        )}
    </header>
  );
}
