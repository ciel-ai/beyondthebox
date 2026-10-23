"use client";

import Link from "next/link";
import { useState } from "react";
import { computePrice, formatPaise, formatRate, type PricingConfig } from "@/lib/pricing";
import type { TierCodeValue } from "@/lib/schemas";
import { CheckIcon } from "./brand";

/**
 * Money with the ₹ sign in the system font. Manrope's ₹ lives in its latin-ext file (15KB),
 * which would otherwise download on the home page just for this glyph (mobile LCP budget).
 */
function Money({ paise, whole }: { paise: number; whole?: boolean }) {
  const text = formatPaise(paise, { whole });
  return (
    <>
      <span className="rupee">₹</span>
      {text.replace("₹", "")}
    </>
  );
}

export type TicketTierView = {
  code: TierCodeValue;
  name: string;
  pricePaise: number;
  inclusions: string[];
  serial: string;
  available: number;
  salesOpen: boolean;
};

/* ---------- geometry: square ticket, 400 units, notches at the perforation ---------- */

const S = 400;
const PERF = 0.72 * S;
const R = 14;
const C = 4;

function outline(d = 0) {
  const [x0, y0, x1, y1] = [d, d, S - d, S - d];
  const r = R + d;
  const h = Math.sqrt(Math.max(r * r - d * d, 0));
  const c = Math.max(C - d, 0.5);
  const large = d < 0 ? 1 : 0;
  return `M${x0 + c} ${y0}H${x1 - c}Q${x1} ${y0} ${x1} ${y0 + c}V${PERF - h}A${r} ${r} 0 ${large} 0 ${x1} ${PERF + h}V${y1 - c}Q${x1} ${y1} ${x1 - c} ${y1}H${x0 + c}Q${x0} ${y1} ${x0} ${y1 - c}V${PERF + h}A${r} ${r} 0 ${large} 0 ${x0} ${PERF - h}V${y0 + c}Q${x0} ${y0} ${x0 + c} ${y0}Z`;
}

function mask(d: number): React.CSSProperties {
  const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${S} ${S}'><path d='${outline(d)}'/></svg>`)}")`;
  return { maskImage: url, WebkitMaskImage: url, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" };
}
const OUTER = mask(0);
const INNER = mask(3.5);
const LEAF: React.CSSProperties = { backgroundImage: "var(--leaf)" };

const MATERIAL = {
  STANDARD: { text: "text-white", accent: "text-gold-deep", soft: "text-muted", perf: "#DDBB4B", ctl: "border-edge hover:border-gold-deep", btn: "btn-dark" },
  PREMIUM: { text: "text-white", accent: "text-gold-deep", soft: "text-muted", perf: "#EFDA72", ctl: "border-edge hover:border-gold-deep", btn: "btn-dark" },
  VIP: { text: "text-black", accent: "text-black", soft: "text-black/75", perf: "#000000", ctl: "border-black/40 hover:border-black", btn: "bg-black text-white border border-black hover:bg-[#111]" },
} as const;

function Ticket({
  t,
  qty,
  max,
  selected,
  dateLabel,
  venue,
  onQty,
  onSelect,
}: {
  t: TicketTierView;
  qty: number;
  max: number;
  selected: boolean;
  dateLabel: string;
  venue: string;
  onQty: (n: number) => void;
  onSelect: () => void;
}) {
  const m = MATERIAL[t.code];
  const soldOut = !t.salesOpen || t.available <= 0;
  const id = `ticket-${t.code}`;
  return (
    <article aria-labelledby={id} className={`@container relative aspect-square w-full ${t.code === "VIP" ? "on-gold" : ""}`}>
      {/* material */}
      {t.code === "STANDARD" && <div className="absolute inset-0 bg-black" style={OUTER} aria-hidden />}
      {t.code === "PREMIUM" && (
        <>
          <div className="absolute inset-0" style={{ ...OUTER, ...LEAF }} aria-hidden />
          <div className="absolute inset-0 bg-surface-2" style={INNER} aria-hidden />
        </>
      )}
      {t.code === "VIP" && <div className="absolute inset-0" style={{ ...OUTER, ...LEAF }} aria-hidden />}

      <svg viewBox={`0 0 ${S} ${S}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {t.code === "STANDARD" && <path d={outline(0.5)} fill="none" stroke="#DDBB4B" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        {selected && <path d={outline(-7)} fill="none" stroke="#DDBB4B" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        <line x1={R + 10} x2={S - R - 10} y1={PERF} y2={PERF} stroke={m.perf} strokeOpacity={0.55} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* printed face */}
      <div className={`absolute inset-x-0 top-0 flex h-[72%] flex-col px-[6cqi] pb-[3.5cqi] pt-[5.5cqi] ${m.text}`}>
        <div className={`flex items-baseline justify-between gap-2 text-[max(12px,2.9cqi)] font-semibold uppercase tracking-[0.08em] ${m.soft}`}>
          <span className="whitespace-nowrap">Beyond the Limits</span>
          <span className="tnum whitespace-nowrap">{t.serial}</span>
          <span className="whitespace-nowrap">Admit one</span>
        </div>
        <h3 id={id} className={`display mt-[5cqi] text-[12cqi] ${m.accent}`}>
          {t.name}
        </h3>
        <p className="mt-[2cqi] flex items-baseline gap-2">
          <span className="tnum text-[8.5cqi] font-bold leading-none">
            <Money paise={t.pricePaise} whole />
          </span>
          <span className={`text-[max(12px,3cqi)] font-medium ${m.soft}`}>+ GST</span>
        </p>
        <ul className="mt-auto space-y-[0.6cqi] text-[max(13px,3.4cqi)] leading-[1.35]" aria-label={`${t.name} inclusions`}>
          {t.inclusions.length ? (
            t.inclusions.slice(0, 4).map((inc) => (
              <li key={inc} className="flex items-center gap-2">
                <CheckIcon className="shrink-0" />
                {inc}
              </li>
            ))
          ) : (
            <li className={m.soft}>[Inclusions to be confirmed]</li>
          )}
        </ul>
      </div>

      {/* stub */}
      <div className={`absolute inset-x-0 bottom-0 flex h-[28%] flex-col justify-between px-[6cqi] pb-[4.5cqi] pt-[3.5cqi] ${m.text}`}>
        <p className={`tnum flex justify-between gap-3 text-[max(12px,2.9cqi)] font-medium ${m.soft}`}>
          <span>{dateLabel}</span>
          <span className="truncate">{venue === "To be announced" ? "Venue TBA" : venue}</span>
        </p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={`${t.name} quantity`} className="flex items-center">
            <button
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-md border text-[18px] disabled:opacity-35 ${m.ctl}`}
              onClick={() => onQty(qty - 1)}
              disabled={soldOut || qty <= 1}
              aria-label={`Fewer ${t.name} tickets`}
            >
              −
            </button>
            <output className="tnum w-8 text-center text-[16px] font-semibold" aria-live="polite" aria-label={`${qty} tickets`}>
              {qty}
            </output>
            <button
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-md border text-[18px] disabled:opacity-35 ${m.ctl}`}
              onClick={() => onQty(qty + 1)}
              disabled={soldOut || qty >= max}
              aria-label={`More ${t.name} tickets`}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onSelect}
            disabled={soldOut}
            aria-pressed={selected}
            className={`btn btn-sm min-w-0 flex-1 !px-3 ${selected ? "btn-leaf" : m.btn}`}
          >
            {soldOut ? "Sold out" : selected ? (
              <>
                Selected <CheckIcon />
              </>
            ) : (
              "Select"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function Tickets({
  tiers,
  pricing,
  maxPerOrder,
  dateLabel,
  venue,
}: {
  tiers: TicketTierView[];
  pricing: PricingConfig;
  maxPerOrder: number;
  dateLabel: string;
  venue: string;
}) {
  const [selected, setSelected] = useState<TierCodeValue | null>(null);
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(tiers.map((t) => [t.code, 1])));

  const tier = tiers.find((t) => t.code === selected) ?? null;
  const maxFor = (t: TicketTierView) => Math.max(1, Math.min(maxPerOrder, t.available));
  const price = tier ? computePrice(tier.pricePaise, qty[tier.code]!, pricing) : null;

  return (
    <section id="tickets" className="section-y border-t border-hairline" aria-labelledby="tickets-title">
      <div className="wrap">
        <div className="grid-12 gap-y-4">
          <h2 id="tickets-title" className="display display-l col-span-12 lg:col-span-8">
            Book your pass
          </h2>
          <p className="meta col-span-12 self-end text-muted lg:col-span-4 lg:text-right">
            Up to {maxPerOrder} tickets per order. Every attendee gets their own e-ticket.
          </p>
        </div>

        <div
          role="list"
          aria-label="Passes"
          className="-mx-[var(--gutter)] mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-6 pt-3 [scroll-padding-inline:var(--gutter)] [scrollbar-color:#333_transparent] [scrollbar-width:thin] md:gap-6 xl:mx-0 xl:grid xl:grid-cols-3 xl:gap-[var(--gutter)] xl:overflow-visible xl:px-0"
        >
          {tiers.map((t) => (
            <div key={t.code} role="listitem" className="w-[min(86vw,420px)] shrink-0 snap-start p-2 md:w-[min(42vw,420px)] lg:w-[min(40vw,420px)] xl:w-auto">
              <Ticket
                t={t}
                qty={qty[t.code]!}
                max={maxFor(t)}
                selected={selected === t.code}
                dateLabel={dateLabel}
                venue={venue}
                onQty={(n) => setQty((q) => ({ ...q, [t.code]: Math.max(1, Math.min(maxFor(t), n)) }))}
                onSelect={() => setSelected((s) => (s === t.code ? null : t.code))}
              />
            </div>
          ))}
        </div>

        <div aria-live="polite">
          {tier && price && (
              <div
                key="summary"
                className="rise-in mt-8 grid gap-6 rounded-sm border border-hairline bg-surface p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8"
              >
                <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="sr-only">Selection</dt>
                    <dd className="display text-[32px]">
                      <span className="tnum">{price.quantity}</span> <span className="font-sans text-[24px] font-semibold">×</span> {tier.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta text-muted">Subtotal</dt>
                    <dd className="tnum font-semibold"><Money paise={price.subtotalPaise} /></dd>
                  </div>
                  <div>
                    <dt className="meta text-muted">GST ({formatRate(pricing.gstRateBps)})</dt>
                    <dd className="tnum font-semibold"><Money paise={price.taxPaise + price.feeTaxPaise} /></dd>
                  </div>
                  <div>
                    <dt className="meta text-muted">Fees</dt>
                    <dd className="tnum font-semibold"><Money paise={price.feePaise} /></dd>
                  </div>
                  <div>
                    <dt className="meta text-muted">Total</dt>
                    <dd className="tnum text-[20px] font-bold text-gold-deep"><Money paise={price.totalPaise} /></dd>
                  </div>
                </dl>
                <Link href={`/checkout/details?tier=${tier.code}&qty=${price.quantity}`} className="btn btn-leaf w-full md:w-auto">
                  Continue to checkout
                </Link>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
