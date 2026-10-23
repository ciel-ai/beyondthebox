"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

// [Stage photos]: the organiser's own or properly licensed images. Until supplied, dark placeholders.
const PHOTOS: { src: string | null; alt: string }[] = Array.from({ length: 8 }, () => ({ src: null, alt: "" }));

// Small per-frame rotation and vertical offset so the band reads as hand-placed prints.
const ROTATE = [-2, 1.4, -0.8, 2, -1.6, 0.9, -0.4, 1.7];
const OFFSET = [0, 18, -10, 12, -16, 8, -4, 14];
const SHADES = ["#141414", "#1a1a1a", "#161616", "#1c1c1c", "#131313", "#191919", "#171717", "#1b1b1b"];

const MARQUEE = "Beyond the Limits • Keynotes • Awards • Networking • Exhibitions • Entertainment • ";

function Frame({ i }: { i: number }) {
  const p = PHOTOS[i % PHOTOS.length]!;
  return (
    <div
      className="relative aspect-[3/4] w-[150px] shrink-0 overflow-hidden rounded-xs md:w-[210px] lg:w-[min(300px,22vw)]"
      style={{ transform: `translateY(${OFFSET[i % 8]}px) rotate(${ROTATE[i % 8]}deg)`, background: SHADES[i % 8] }}
    >
      {p.src ? (
        <Image src={p.src} alt="" fill sizes="(min-width: 1024px) 300px, 210px" className="object-cover" />
      ) : (
        <span className="absolute bottom-3 left-3 text-[12px] font-medium text-muted">[Stage photo]</span>
      )}
    </div>
  );
}

export function Hero({ dateLabel, venue }: { dateLabel: string; venue: string }) {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 48 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: [0.2, 0.7, 0.1, 1] as const },
        };

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pb-20 pt-[96px] md:pb-24">
      <h1 id="hero-title" className="sr-only">
        Beyond the Limits — A Business Conclave 2026
      </h1>

      {/* Photo strip: band tilted -4°, rising left to right, drifting left on a seamless loop. */}
      <motion.div aria-hidden className="relative" {...enter(0.05)}>
        <div className="-mx-[12vw] -rotate-[4deg] py-5">
          <div className="loop-left flex w-max">
            {Array.from({ length: PHOTOS.length * 2 }, (_, i) => (
              <Frame key={i} i={i} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Marquee: one line of giant type moving right, opposite to the strip. */}
      <motion.div aria-hidden className="mt-6 overflow-hidden md:mt-8" {...enter(0.22)}>
        <div className="loop-right display flex w-max whitespace-nowrap text-[max(9.5vw,3.25rem)] leading-[0.95]">
          <span className="pr-[0.25em]">{MARQUEE}</span>
          <span className="pr-[0.25em]">{MARQUEE}</span>
        </div>
      </motion.div>

      <div className="wrap mt-8 flex flex-col items-center text-center">
        <p className="ui text-white">
          <span className="tnum">{dateLabel}</span> · {venue === "To be announced" ? "Venue to be announced" : venue}
        </p>
        <p className="mt-3 text-[18px] text-muted">Where ambition meets opportunity.</p>
        <a href="#tickets" className="btn btn-leaf mt-8">
          Book your pass
        </a>
      </div>
    </section>
  );
}
