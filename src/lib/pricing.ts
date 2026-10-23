/**
 * Pricing in integer paise. Shared by the client (display only) and the server
 * (authoritative: the server recomputes from the database and snapshots the result).
 */

export type FeeMode = "NONE" | "FIXED_PER_TICKET" | "PERCENT";

export type PricingConfig = {
  gstRateBps: number;
  pricesIncludeGst: boolean;
  feeMode: FeeMode;
  /** Paise per ticket for FIXED_PER_TICKET, basis points for PERCENT. */
  feeValue: number;
  feeTaxable: boolean;
};

export type PriceBreakdown = {
  unitPricePaise: number;
  quantity: number;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  totalPaise: number;
};

/** Round n/d half-up for non-negative integers, exactly. */
export function roundDiv(n: number, d: number) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 0 || d <= 0) {
    throw new Error("roundDiv expects non-negative safe integers");
  }
  return Math.floor((2 * n + d) / (2 * d));
}

export function computePrice(unitPricePaise: number, quantity: number, cfg: PricingConfig, discountPaise = 0): PriceBreakdown {
  if (!Number.isInteger(unitPricePaise) || unitPricePaise < 0) throw new Error("Invalid unit price");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Invalid quantity");

  const subtotalPaise = unitPricePaise * quantity;
  const discount = Math.min(Math.max(0, Math.trunc(discountPaise)), subtotalPaise);
  const ticketAmount = subtotalPaise - discount;

  let taxablePaise: number;
  let taxPaise: number;
  if (cfg.pricesIncludeGst) {
    taxablePaise = roundDiv(ticketAmount * 10_000, 10_000 + cfg.gstRateBps);
    taxPaise = ticketAmount - taxablePaise;
  } else {
    taxablePaise = ticketAmount;
    taxPaise = roundDiv(ticketAmount * cfg.gstRateBps, 10_000);
  }

  let feePaise = 0;
  if (cfg.feeMode === "FIXED_PER_TICKET") feePaise = cfg.feeValue * quantity;
  else if (cfg.feeMode === "PERCENT") feePaise = roundDiv((taxablePaise + taxPaise) * cfg.feeValue, 10_000);
  const feeTaxPaise = cfg.feeTaxable ? roundDiv(feePaise * cfg.gstRateBps, 10_000) : 0;

  return {
    unitPricePaise,
    quantity,
    subtotalPaise,
    discountPaise: discount,
    taxablePaise,
    taxPaise,
    feePaise,
    feeTaxPaise,
    totalPaise: taxablePaise + taxPaise + feePaise + feeTaxPaise,
  };
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatPaise(paise: number, opts: { whole?: boolean } = {}) {
  const rupees = paise / 100;
  return opts.whole && paise % 100 === 0 ? inrWhole.format(rupees) : inr.format(rupees);
}

export function formatRate(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}
