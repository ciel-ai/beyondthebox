"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpeakerCard, type SpeakerCardData } from "./SpeakerCard";

/** How much of the first card is cut off on the left at rest (desktop). */
const CUT = 0.33;

/**
 * Full-bleed row of speaker cards.
 * - Touch: native swipe with CSS scroll-snap.
 * - Fine pointer (desktop): a frosted "• DRAG •" cursor, click-and-drag with momentum, then a
 *   JS snap to positions that leave the first visible card partly cut off, as in the reference.
 *   The very start stays reachable so the first card can be seen whole.
 * - Keyboard: the row is focusable; arrow keys move one card.
 */
export function SpeakerRow({ cards }: { cards: SpeakerCardData[] }) {
  const row = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [fine, setFine] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const drag = useRef({ active: false, moved: 0, startX: 0, startScroll: 0, lastX: 0, lastT: 0, v: 0, raf: 0, snapping: false });

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Rest positions: the start, then each card with CUT of the previous edge hidden. */
  const targets = useCallback(() => {
    const el = row.current;
    if (!el) return [0];
    const list = [...el.querySelectorAll<HTMLElement>("[data-card]")].map((c) => c.offsetLeft + c.offsetWidth * CUT);
    const max = el.scrollWidth - el.clientWidth;
    return [0, ...list.map((t) => Math.min(t, max))];
  }, []);

  const snapTo = useCallback(
    (direction: 0 | 1 | -1 = 0) => {
      const el = row.current;
      if (!el) return;
      const ts = targets();
      const x = el.scrollLeft;
      let target: number;
      if (direction === 0) target = ts.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      else if (direction === 1) target = ts.find((t) => t > x + 4) ?? ts[ts.length - 1]!;
      else target = [...ts].reverse().find((t) => t < x - 4) ?? 0;
      drag.current.snapping = true;
      el.scrollTo({ left: target, behavior: reduce() ? "auto" : "smooth" });
      window.setTimeout(() => (drag.current.snapping = false), 500);
    },
    [targets],
  );

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    const el = row.current;
    // Trackpad and wheel scrolling settle on a rest position too.
    const onEnd = () => {
      if (mq.matches && !drag.current.active && !drag.current.snapping) snapTo(0);
    };
    el?.addEventListener("scrollend", onEnd);
    return () => {
      mq.removeEventListener("change", update);
      el?.removeEventListener("scrollend", onEnd);
    };
  }, [snapTo, targets]);

  // Desktop: start with the first card partly cut off on the left. Runs after the snap
  // classes are removed for fine pointers, otherwise CSS snapping would pull it back to 0.
  const placed = useRef(false);
  useEffect(() => {
    if (!fine || placed.current || !row.current) return;
    placed.current = true;
    row.current.scrollLeft = targets()[1] ?? 0;
  }, [fine, targets]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !row.current) return;
    const d = drag.current;
    cancelAnimationFrame(d.raf);
    Object.assign(d, { active: true, moved: 0, startX: e.clientX, startScroll: row.current.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (fine && cursor.current) cursor.current.style.transform = `translate3d(${e.clientX - 85}px, ${e.clientY - 85}px, 0)`;
    const d = drag.current;
    if (!d.active || !row.current) return;
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
    d.moved = Math.max(d.moved, Math.abs(e.clientX - d.startX));
    row.current.scrollLeft = d.startScroll - (e.clientX - d.startX);
  };

  const release = () => {
    const d = drag.current;
    if (!d.active || !row.current) return;
    d.active = false;
    const el = row.current;
    let v = reduce() ? 0 : d.v * 16;
    const glide = () => {
      if (Math.abs(v) > 0.5) {
        el.scrollLeft -= v;
        v *= 0.93;
        d.raf = requestAnimationFrame(glide);
      } else {
        snapTo(0);
      }
    };
    glide();
  };

  // A drag must not count as a click on the card link.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved > 6) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = 0;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (fine) {
      snapTo(e.key === "ArrowRight" ? 1 : -1);
    } else {
      const card = row.current?.querySelector<HTMLElement>("[data-card]");
      const step = (card?.offsetWidth ?? 340) + 10;
      row.current?.scrollBy({ left: e.key === "ArrowRight" ? step : -step, behavior: reduce() ? "auto" : "smooth" });
    }
  };

  // Hide the drag cursor over the social buttons, which need the normal pointer.
  const onPointerOver = (e: React.PointerEvent) => {
    if (!fine) return;
    setShowCursor(!(e.target as HTMLElement).closest("ul a, ul [role=img]"));
  };

  return (
    <div className="relative">
      <div
        ref={row}
        role="region"
        aria-label="Speakers. Use the arrow keys to scroll."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerEnter={() => fine && setShowCursor(true)}
        onPointerLeave={() => {
          setShowCursor(false);
          release();
        }}
        onPointerOver={onPointerOver}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        className={`flex gap-[10px] overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-4 [scrollbar-width:none] select-none [&::-webkit-scrollbar]:hidden ${
          fine ? "" : "snap-x snap-mandatory [scroll-padding-left:var(--gutter)]"
        } ${fine && showCursor ? "cursor-none" : ""}`}
      >
        {cards.map((c, i) => (
          <div key={c.tba ? `tba-${i}` : c.slug} data-card className="w-[78vw] max-w-[340px] shrink-0 snap-start lg:w-[430px] lg:max-w-none">
            <SpeakerCard s={c} />
          </div>
        ))}
        <span className="w-[calc(var(--gutter)-10px)] shrink-0" aria-hidden />
      </div>

      {fine && (
        <div
          ref={cursor}
          aria-hidden
          className={`pointer-events-none fixed left-0 top-0 z-40 flex h-[170px] w-[170px] items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-opacity duration-150 ${
            showCursor ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="ui text-[12px] text-white">• Drag •</span>
        </div>
      )}
    </div>
  );
}
