"use client";

import { useEffect, useRef, useState } from "react";

const TEXT = "20 December 2026 • A Business Conclave 2026 • Where ambition meets opportunity • ";

/**
 * Flat gold ribbon directly under the hero. Decorative (it repeats the hero's facts), so it's
 * hidden from assistive tech. CSS transform loop, paused off screen; static with reduced motion.
 */
export function GoldTicker() {
  const ref = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="ticker" aria-hidden data-paused={offscreen || undefined}>
      <div className="ticker__track display whitespace-nowrap text-[18px] leading-none tracking-[0.04em] md:text-[22px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="pr-[0.6em]">
            {TEXT}
          </span>
        ))}
      </div>
    </div>
  );
}
