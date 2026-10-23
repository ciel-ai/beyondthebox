/** GST helpers: GSTIN validation, tax split, financial year and invoice numbering. */

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Format and mod-36 checksum. */
export function isValidGstin(raw: string) {
  const g = raw.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  const check = CHARS[(36 - (sum % 36)) % 36];
  return g[14] === check;
}

export function gstStateCode(gstin: string) {
  return gstin.slice(0, 2);
}

/**
 * Intra-state supply → CGST + SGST (half each, odd paise to SGST); inter-state → IGST.
 * Place of supply for event admission is normally the venue's state; until the venue is
 * set, the organiser's state is used. Flagged for the accountant.
 */
export function splitTax(taxPaise: number, intraState: boolean) {
  if (!intraState) return { cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
  const cgstPaise = Math.floor(taxPaise / 2);
  return { cgstPaise, sgstPaise: taxPaise - cgstPaise, igstPaise: 0 };
}

/** Indian financial year (April–March) in IST, e.g. "26-27". */
export function financialYear(at: Date) {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
}

/** BTL/26-27/00001: 15 characters (GST limit is 16). */
export function invoiceNumber(series: string, fy: string, seq: number) {
  const n = `${series}/${fy}/${String(seq).padStart(5, "0")}`;
  if (n.length > 16) throw new Error(`Invoice number ${n} exceeds 16 characters`);
  return n;
}
