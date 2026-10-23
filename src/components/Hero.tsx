"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// [Stage photos]: the organiser's own or properly licensed images. Until supplied, dark placeholders.
const PHOTOS: { src: string | null }[] = Array.from({ length: 8 }, () => ({ src: null }));

// Per-frame rotation (deg) and vertical offset (% of frame height) so the band reads as hand-placed prints.
const ROTATE = [-2, 1.4, -0.8, 2, -1.6, 0.9, -0.4, 1.7];
const OFFSET = [0, 4.5, -2.5, 3, -4, 2, -1, 3.5];
const SHADES = ["#141414", "#1a1a1a", "#161616", "#1c1c1c", "#131313", "#191919", "#171717", "#1b1b1b"];

const MARQUEE = "Beyond the Limits • Keynotes • Awards • Networking • Exhibitions • Entertainment • ";

function Frame({ i }: { i: number }) {
  const p = PHOTOS[i % PHOTOS.length]!;
  const lcp = i < 3; // only the first three of the first set are high priority; duplicates reuse URLs
  return (
    <div
      className="hero__frame"
      style={{ translate: `0 ${OFFSET[i % 8]}%`, rotate: `${ROTATE[i % 8]}deg`, background: SHADES[i % 8] }}
    >
      {p.src ? (
        <Image
          src={p.src}
          alt=""
          fill
          sizes="(min-width: 1024px) 330px, (min-width: 768px) 240px, 160px"
          className="object-cover"
          priority={lcp}
          fetchPriority={lcp ? "high" : "auto"}
          loading={lcp ? "eager" : "lazy"}
        />
      ) : (
        <span className="absolute bottom-3 left-3 text-[12px] font-medium text-muted">[Stage photo]</span>
      )}
    </div>
  );
}

export function Hero({ dateLabel, venue }: { dateLabel: string; venue: string }) {
  const ref = useRef<HTMLElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  // Pause the CSS loops while the hero is off screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="hero" data-paused={offscreen || undefined}>
      <h1 id="hero-title" className="sr-only">
        Beyond the Limits — A Business Conclave 2026
      </h1>

      <div aria-hidden className="hero__header-space" />

      {/* Photo strip: takes the remaining height; tilted band drifting left on a seamless loop. */}
      {/* Entrance is pure CSS (hero-rise): it starts at first paint, nav first, hero at 150ms. */}
      <div aria-hidden className="hero__strip hero-enter">
        <div className="hero__band">
          <div className="hero__track loop-left">
            {Array.from({ length: PHOTOS.length * 2 }, (_, i) => (
              <Frame key={i} i={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Marquee: one line of giant type moving right, opposite to the strip. */}
      <div aria-hidden className="hero__marquee hero-enter hero-enter--late" data-testid="hero-marquee">
        <div className="loop-right display flex w-max whitespace-nowrap">
          <span className="pr-[0.25em]">{MARQUEE}</span>
          <span className="pr-[0.25em]">{MARQUEE}</span>
        </div>
      </div>

      <div className="hero__meta wrap">
        <div className="hero__copy">
          {/* Fixed line structure: the meta block's height must not change when the web font swaps
              in (the strip above takes the remaining height, so any change would shift the photos). */}
          <p className="ui text-white">
            <span className="tnum hero__nowrap">{dateLabel}</span>
            <span className="hero__sep" aria-hidden>
              {" · "}
            </span>
            <span className="hero__nowrap hero__venue">{venue === "To be announced" ? "Venue to be announced" : venue}</span>
          </p>
          <p className="hero__nowrap text-[17px] text-muted md:text-[18px]">Where ambition meets opportunity.</p>
        </div>
        <a id="hero-cta" href="#tickets" className="btn btn-leaf hero__cta">
          Book your pass
        </a>
      </div>
    </section>
  );
}
