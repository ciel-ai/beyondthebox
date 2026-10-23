# Beyond the Limits — A Business Conclave 2026
## Technical plan (v2, approved with changes)

### 1. Stack and environments
- Next.js 16 (current stable; fall back to 15 only if a key dependency blocks), TypeScript strict, Tailwind v4, Framer Motion, Prisma 7.10 (stable; npm's `latest` tag currently points to an 8.0 release candidate, which we avoid).
- PostgreSQL + Prisma on **Supabase** (approved): Postgres, a private Storage bucket (nomination files, signed URLs), and Auth with **TOTP 2FA required for every admin** (session must be AAL2).
- **Running costs** (checked October 2026 on supabase.com/pricing, vercel.com/pricing and Vercel's cron docs; confirm at sign-up):

  | Service | Plan | Price | Why this plan |
  |---|---|---|---|
  | Vercel | **Pro** | $20/month per developer seat (includes $20 usage credit; viewer seats free). Budget 1–2 seats: $20–40 | Hobby is "for personal, non-commercial use" and limits cron jobs to once a day; the job worker needs a per-minute cron |
  | Supabase (production) | **Pro** | $25/month, includes $10 compute credit (one Micro instance), daily backups kept 7 days, never paused | Paid projects aren't paused for inactivity; backups |
  | Supabase (staging) | second project in the same org | ≈$10/month compute | Staging must not share a database with production |
  | Supabase PITR | add-on, optional | $100/month per 7 days of retention | Only worth it during the sales window |
  | Razorpay | Standard | per-transaction fee per the organiser's Razorpay agreement; no monthly fee | — |
  | Resend | Free tier | $0 at launch volumes (confirm limits at sign-up) | Upgrade if monthly email volume exceeds the free tier |
  | Upstash Redis | Free tier | $0 at this traffic | Rate limiting only |
  | Cloudflare Turnstile | Free | $0 | — |
  | Sentry (Phase 4) | Developer (free) | $0 | — |
  | Vercel Password Protection | not used | ($20/month per project if ever enabled) | Staging uses the free Vercel Authentication plus an automation bypass instead |

  **Fixed monthly total: about $55–75** (Vercel $20–40 + Supabase $25 + staging ≈$10), plus Razorpay fees and the optional PITR.
- Razorpay (behind a `PaymentProvider` interface), Resend + React Email, `qrcode`, `@react-pdf/renderer`, Zod, Turnstile, Upstash Ratelimit, Sentry, Vercel.
- **Environments:**
  - **Local:** Docker Postgres. Payments use a fake provider with real HMAC.
  - **Staging:** Vercel preview on the `staging` branch, its own database, Razorpay **test** keys, Resend test domain.
  - **Production:** `main` branch, its own database, **live** keys.

  Nothing is shared between staging and production. Every account is opened by the organiser and we are invited as members.
- Secrets live only in Vercel environment variables. `.env.example` lists every key with a comment. A pre-commit secret scan runs (gitleaks).

### 2. Data model (Prisma, abridged)
All money is `Int` paise. All timestamps are UTC, displayed in IST.

```
EventSettings   (singleton) name, subtitle, tagline, startsAt, venueName?, venueAddress?,
                capacityTotal=1000, maxTicketsPerOrder=10, holdMinutes=15,
                gstRateBps=1800, pricesIncludeGst=false, taxConfirmedByAccountant=false,
                feeMode(NONE|FIXED_PER_TICKET|PERCENT), feeValue, feeTaxable=true,
                organiserLegalName?, organiserGstin?, organiserAddress?, organiserStateCode?, sacCode?,
                nominationsOpenAt?, nominationsCloseAt?, retentionMonthsAfterEvent?,
                paymentsMode(TEST|LIVE)=TEST, capacityConfirmed=false   ← go-live gate inputs
TicketTier      code(STANDARD|PREMIUM|VIP), name, pricePaise, capacity, soldCount,
                inclusions String[] (empty → "[Inclusions to be confirmed]"), salesOpen, sort, serialPrefix
Booking         reference UNIQUE (BTL26-XXXXXX), status, tierId, quantity,
                buyerNameEnc, buyerEmailEnc, buyerEmailIdx, buyerPhoneEnc,
                buyerCompanyEnc?, buyerGstinEnc?,
                unitPricePaise, subtotalPaise, discountPaise, taxPaise, feePaise, feeTaxPaise, totalPaise,
                discountCodeId?, termsVersion, termsAcceptedAt, createdAt, confirmedAt?
SeatHold        bookingId UNIQUE, tierId, quantity, expiresAt, releasedAt?, convertedAt?
Attendee        bookingId, nameEnc, emailEnc, emailIdx, phoneEnc, position
PaymentAttempt  bookingId, provider, providerOrderId UNIQUE, idempotencyKey UNIQUE,
                amountPaise, status(CREATED|PAID|FAILED|ABANDONED), createdAt
Payment         providerPaymentId UNIQUE  ← the double-confirm guard
                bookingId, attemptId, amountPaise, method,
                status(AUTHORIZED|CAPTURED|FAILED|LAPSED|REFUNDED),
                decision(CAPTURE|DO_NOT_CAPTURE|REFUND), reason?, seatsSecuredAt?, capturedAt?
Refund          providerRefundId UNIQUE, paymentId, amountPaise, reason, status, initiatedBy
Ticket          id (cuid), bookingId, attendeeId UNIQUE, serial UNIQUE,
                status(VALID|CANCELLED|REFUNDED), checkedInAt?, checkedInBy?, checkedInDevice?
Invoice         number UNIQUE (BTL/26-27/00001: ≤16 chars), financialYear, seq, bookingId UNIQUE,
                snapshot of figures and parties
InvoiceCounter  (series, financialYear) PK, last  ← row-locked inside confirmBooking: consecutive, no gaps,
                resets each 1 April (IST). Format to be confirmed by the organiser's accountant.
CreditNote      own series (e.g. BTL/CN/26-27/0001), invoiceId, refundId   (Phase 2, with refunds)
PaymentEvent    provider, type, providerEventId UNIQUE, bookingId?, signatureValid,
                payloadEnc (raw body, encrypted; readable by finance/owner only), receivedAt   ← transactions log
CancellationRequest  bookingId, reason, status(REQUESTED|APPROVED|REJECTED), decidedBy?, note?
BookingAccessToken   tokenHash UNIQUE, bookingId, expiresAt, usedAt?   (find-my-booking link)
Job             kind(EMAIL|CAPTURE|REFUND|ADMIN_ALERT), payload (no plaintext PII; IDs only),
                dedupeKey UNIQUE, runAt, attempts, lockedAt?, doneAt?, lastError?   ← transactional outbox
DiscountCode    code UNIQUE, type(PERCENT|FIXED), value, usageLimit, usedCount, expiresAt, tierIds[]
Speaker, Sponsor(tier, logo, url, visible, sort), AgendaItem, Faq, AwardCategory(requiresDocuments),
ExhibitionPackage, LegalDocument(kind, version, body, approvedAt?)
SponsorshipEnquiry, ExhibitionEnquiry, Nomination(status, files[]), InternalNote
AdminUser(authUserId, role: OWNER|ADMIN|FINANCE|CHECKIN), AuditLog(actor, action, target, diff, at)
FunnelCount(day, step: VISIT|CHECKOUT_STARTED|PAID, count)   ← cookieless aggregates, no PII
CheckinDevice, CheckinSync(deviceId, ticketId, scannedAt, result, conflict?)
```

**Personal data at rest:**
- Supabase encrypts the disk.
- On top of that, every personal field (`*Enc`) is AES-256-GCM encrypted in the app, with a key ID so keys can be rotated.
- **Blind indexes (approved addition B):** next to every encrypted email and phone we store `HMAC-SHA256(normalise(value), PII_INDEX_KEY)`. Email is normalised to trimmed lowercase; phone to E.164 (`+91…`). Find my booking, admin search, duplicate checks and check-in search all query the index, never the ciphertext. The index key is separate from the encryption key, and rotating it means re-indexing.
- Admin name search decrypts in memory. That is fine at this scale (about 1,000 bookings), and noted as a limit.

### 3. Pricing (one shared function, server is authoritative)
`price(tier, qty, settings, discount?) → {unit, subtotal, discount, taxable, tax, fee, feeTax, total}` in integer paise, rounding half-up once per line.
- **GST-exclusive (default):** tax = round(taxable × rate).
- **GST-inclusive:** tax = taxable − round(taxable / (1 + rate)).
- **Fee:** off by default. When on, it can be taxable.

The client uses the same function only for display. `POST /api/bookings` recomputes from the database and snapshots the result on the booking. The amount sent to Razorpay always comes from that snapshot. The review page shows the server's numbers.

GST at 18% exclusive is the default, flagged **"confirm with accountant"** in admin until ticked. The invoice splits CGST and SGST, or uses IGST, based on place of supply. For event admission that is usually the venue's state, which is still TBA, so the invoice stays in draft mode until the organiser GSTIN, state and SAC code are entered.

### 4. Booking and payment flow

```
/tickets ─ tier, qty ─▶ /checkout/details ─ POST /api/bookings ─▶ /checkout/[ref]/review
                         (attendees, optional GSTIN,               (server totals, 15:00 timer,
                          Turnstile)                                 Terms + Refund checkbox)
        ─ POST /api/bookings/[ref]/pay ─▶ Razorpay Checkout ─▶ POST /api/payments/verify
                                                              └▶ /booking/[ref]  (polls status)
Razorpay ── POST /api/webhooks/razorpay ──────────────────────────▶ confirmBooking()
```

1. **Create the booking and hold**: `POST /api/bookings`. Zod, then rate limit, then Turnstile, then one transaction:
   - `SELECT … FROM "TicketTier" WHERE id=$1 FOR UPDATE`
   - check `salesOpen`, `qty ≤ maxTicketsPerOrder`, and `soldCount + Σ(active holds) + qty ≤ capacity`
   - insert Booking (PENDING), SeatHold (now + 15 min) and Attendees
   - commit

   Every writer locks the tier row first, so the check-and-insert is serialised. "Active holds" are filtered by `expiresAt > now()`, so **correctness never depends on the cleanup job**. A Vercel Cron every 5 minutes only tidies statuses (PENDING → EXPIRED) and sends nothing.
2. **Create the order**: `POST /api/bookings/[ref]/pay`. Requires the booking's access cookie and `termsAccepted`. Re-checks that the hold is live and reuses an open `PaymentAttempt` if one exists. Otherwise it inserts a new attempt with a unique `idempotencyKey` **before** calling Razorpay, then stores `providerOrderId`. Razorpay Orders doesn't give us a server-side idempotency guarantee we can rely on, so the unique key on our side prevents duplicate orders from double-clicks.
3. **Orders use manual capture.** Each Razorpay order is created with
   `payment: { capture: "manual", capture_options: { manual_expiry_period: 60, refund_speed: "normal" } }`,
   so **nothing is ever auto-captured**. Even if the dashboard is set to auto-capture, the order setting
   overrides it. Any payment we decide not to capture is auto-refunded by Razorpay once the 60-minute window passes.
4. **Securing seats**: `securePayment()`. It is reached from `POST /api/payments/verify` (after the HMAC
   check `order_id|payment_id` with the key secret, timing-safe) or from the signed `payment.authorized` webhook,
   and it **fetches the payment from Razorpay** to check `status=authorized`, amount, currency INR and order ID.
   One transaction:
   - Insert `Payment(AUTHORIZED)` with unique `providerPaymentId`. On conflict, return the current state (duplicate callbacks do nothing).
   - Lock the booking row (`FOR UPDATE`).
   - **Live hold and no other secured payment:** convert the hold (`soldCount += qty` under the tier lock), set `decision=CAPTURE`, and **insert a `CAPTURE` job in the same transaction**.
   - **Hold expired or released (late payment):** lock the tier and try to re-acquire seats. On success, as above. If sold out, `decision=DO_NOT_CAPTURE`. The payment lapses back to the buyer and is never captured. Insert `EMAIL` (buyer: "you have not been charged; the hold on your funds will be released by your bank") and `ADMIN_ALERT` jobs.
   - **Another payment already secured seats (paid twice):** `decision=DO_NOT_CAPTURE`, plus email and alert jobs.
   > **Why the capture call isn't inside the database transaction.** A network call can't be rolled back. If we captured inside the transaction and the commit then failed, the buyer would be charged with no seats. Holding the tier row lock during a call to Razorpay would also block every other buyer of that tier for the length of that call. Instead, seats are secured **and** the capture job is written in one transaction. Only a committed seat allocation can ever lead to a capture, which is the guarantee you asked for, and a crash between commit and capture is recovered by the job.
5. **Capture worker** (`CAPTURE` job): `POST /v1/payments/{id}/capture {amount, currency}`. The amount must equal the authorised amount, and Razorpay documents no idempotency key for this call. So:
   - **Success:** run `confirmBooking()`.
   - **Error:** re-fetch the payment. `captured` means success. `authorized` with a transient error means retry with backoff (well inside the 60-minute window).
   - **Refunded or failed (the window lapsed):** return the seats (`soldCount -= qty`), set the booking to FAILED, queue email and alert jobs.
6. **`confirmBooking(paymentId)`**: idempotent, one transaction. It is also called by the `payment.captured` / `order.paid` webhook, so a worker that dies between capture and confirmation self-heals.
   - Payment becomes CAPTURED. Booking goes PENDING → CONFIRMED only once.
   - Issue tickets only if none exist (`attendeeId` is unique on Ticket).
   - Allocate the invoice number from the row-locked `InvoiceCounter`.
   - **Insert the confirmation `EMAIL` job in the same transaction (approved addition A).** If the process dies after commit, the job is still there, and the worker sends it with retries.
7. **Captured anyway?** If a `payment.captured` arrives for a payment we marked `DO_NOT_CAPTURE` (only possible through a manual dashboard capture), we insert a `REFUND` job (Refunds API, full amount), an email job and an admin alert. This is the "duplicate already captured → refunded automatically" path.
8. **Webhooks** (`POST /api/webhooks/razorpay`):
   - Raw body (`req.text()`), `X-Razorpay-Signature` HMAC with the webhook secret.
   - Insert `PaymentEvent` with the unique `x-razorpay-event-id`. A replay returns 200 with no effect.
   - Dispatch: `payment.authorized` → securePayment; `payment.captured` / `order.paid` → confirmBooking; `payment.failed` → attempt FAILED, booking FAILED, hold released, failed-payment email job; `refund.processed` / `refund.failed` → Refund status.
   - Handlers tolerate any order of arrival. We respond within 5 seconds: heavy work is queued as jobs.
9. **Job worker**: claims jobs with `FOR UPDATE SKIP LOCKED`. It is kicked right after each request (Next.js `after()`) and by a per-minute Vercel Cron as the safety net. Retries back off exponentially, up to 8 attempts, then raise an admin alert.

**Razorpay behaviour this relies on (checked against current docs, Oct 2026; re-verify in test mode):**
- Orders API `payment.capture = "manual"` overrides the dashboard auto-capture setting.
- `manual_expiry_period` max (and default) is 7,200 minutes. "Payments in the authorized state after the manual_expiry_period are auto-refunded." Razorpay also requires authorised payments to be captured within 5 days.
- `refund_speed`: the reference lists `normal` (5–7 working days); the example uses `optimum`. We default to `normal` and will test `optimum` in test mode.
- Capture API: `POST /v1/payments/{id}/capture` with `amount` equal to the authorised amount and `currency`. Errors include "The payment has already been either captured or voided."; the docs recommend fetching the payment before retrying. No idempotency key is documented.
- Webhooks: at-least-once delivery; `x-razorpay-event-id` is unique per event; order not guaranteed; non-2xx or >5 seconds counts as a failure, retried with exponential backoff for 24 hours, and the webhook is **disabled after 24 hours of failures** (the runbook covers re-enabling it).
- Minimum accepted `manual_expiry_period` for manual capture isn't stated (12 minutes is the documented minimum for the automatic period). 60 minutes is our choice. **Verify in test mode.**
- Sources: razorpay.com/docs/payments/payments/capture-settings/api/, /docs/api/payments/capture, /docs/webhooks/best-practices, /docs/webhooks/payments.

**Booking states while paying:** the booking stays `PENDING` from authorisation until capture. The status page shows "Confirming your payment…" and polls. Payment state lives on `Payment`, not on the booking enum.

10. **Retry**: the status page for a FAILED or EXPIRED booking offers "Try payment again". This re-runs the hold check on the same booking (new SeatHold, new PaymentAttempt) if seats remain.

**Booking reference**: `BTL26-` + 6 characters from a 31-character alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, so no 0, O, 1, I or L). That's about 887M combinations; a collision just retries.

**Booking page access (no personal data in URLs):**
- After checkout, the browser gets an HttpOnly cookie scoped to that booking.
- Otherwise `/booking/find` (email + reference, rate limited, Turnstile) emails a one-time link `/booking/access/[token]`. The token is stored hashed, lasts 30 minutes and works once. Opening it sets the cookie and redirects to `/booking/[ref]`.
- Without the cookie, `/booking/[ref]` shows only "Find my booking". It never shows the status or names.

**Cancellation**: from the booking page, the buyer submits a request with a reason. It shows in the admin. An approver chooses no refund / partial / full; a refund goes through the Refunds API. Nothing happens automatically.

### 5. Tickets, QR, PDFs, email
- **QR payload**: `v1.<ticketId>.<base64url(HMAC_SHA256("v1."+ticketId, QR_SECRET))[0..22]>`. No name, email or booking reference.
- **E-ticket PDF** (`@react-pdf/renderer`, Node runtime): event name, date, venue (or "[Venue to be announced]"), tier, attendee name, booking reference, serial, QR.
- **GST invoice PDF**: number `BTL/26-27/00001` (15 characters, limit 16), consecutive and unique per financial year, resetting each 1 April IST. It shows organiser and buyer details (GSTIN and company if given), SAC, and CGST/SGST or IGST lines. Generated from the snapshotted figures, never recomputed. Credit notes use their own series and arrive in Phase 2 with refunds. **The format needs the accountant's confirmation.**
- **Emails** (React Email via Resend, all through the outbox):
  - confirmation with one PDF per attendee plus the invoice
  - payment failed with a retry link
  - ticket resend (admin)
  - find-my-booking link
  - cancellation received / decided
- **Deliverability**: SPF, DKIM (Resend's DNS records) and a DMARC record (`p=none` → `quarantine` after two clean weeks) on the organiser's domain, then seed tests to Gmail and Outlook before launch.

### 5a. Go-live gate (approved addition)
`paymentsMode` starts as TEST. `assertGoLiveReady()` returns a checklist, and switching to LIVE is refused (server-side, audited) unless every item passes:
- organiser legal name, GSTIN (format and checksum valid), state code, SAC code
- Privacy, Terms and Refund policies each **marked approved**
- every tier has inclusions
- seat split confirmed (`capacityConfirmed`)

The payment provider factory reads live keys only when mode is LIVE **and** the gate passes, so a production deploy with live keys still runs on test keys until then. Staging never has live keys. Phase 1 ships the gate logic and its tests; Phase 2 adds the admin checklist screen.

### 6. Check-in (Phase 2)
- **Online**: `/checkin` (CHECKIN role + 2FA) scans with the camera.
  - `POST /api/checkin/verify` checks the HMAC and returns the status.
  - "Admit" runs `UPDATE "Ticket" SET checkedInAt=now() WHERE id=$1 AND checkedInAt IS NULL AND status='VALID' RETURNING …`. Zero rows means already admitted or invalid, so two scanners can never both succeed.
- **Offline fallback**:
  - **Before the event**, staff download the list: `{ticketId, sha256(qrToken), name, tier, status}`. It's encrypted with AES-GCM under a key derived from a staff passphrase (PBKDF2) and held in IndexedDB. The QR secret never leaves the server: a scanned token is valid offline if its SHA-256 matches the list.
  - **Offline admits** are written to a local queue and mark the ticket admitted on that device. They sync when back online, using the same conditional UPDATE. A conflict ("already admitted at 10:02 by Gate B") is recorded and shown to staff.
  - **Honest limit:** if **two devices are offline at the same time**, nothing can stop both admitting the same ticket before they sync. It can only be detected afterwards. **Rule (approved): while offline, one scanner per entrance.** This goes in the check-in staff guide, and the scanner shows a persistent warning banner whenever it is offline.
  - Results never rely on colour alone: each state has an icon **and** a word (VALID / ALREADY CHECKED IN / INVALID).

### 7. Admin (Phases 2–3)
- Supabase Auth, invite-only, **TOTP 2FA enforced** (session must be AAL2). Roles are checked in middleware and again in every server action and route via `requireRole()`.
- Every mutation writes an `AuditLog` entry.
- **Transactions page**: Payments, Refunds and PaymentEvents, filterable by date and status, with CSV export columns that line up with Razorpay settlement reports (payment ID, order ID, amount, fee, tax, settlement ID when available).
- **CSV exports** run on the server for the finance and owner roles, and the export itself is logged.

### 8. API routes
| route | phase | notes |
|---|---|---|
| `POST /api/bookings` | 1 | create booking + hold |
| `GET /api/bookings/[ref]` | 1 | status for polling, cookie-gated |
| `POST /api/bookings/[ref]/pay` | 1 | create or reuse order; also used for retry |
| `POST /api/payments/verify` | 1 | signature, fetch payment, then `confirmBooking` |
| `POST /api/webhooks/razorpay` | 1 | raw-body HMAC, dedupe, dispatch |
| `POST /api/booking-access/request`, `GET /booking/access/[token]` | 1 | find my booking |
| `POST /api/bookings/[ref]/cancellation` | 1 | request only |
| `GET /api/tickets/[id]/pdf`, `GET /api/invoices/[id]/pdf` | 1 | cookie-gated |
| `GET /api/cron/expire-holds`, `GET /api/cron/outbox`, `GET /api/cron/retention` | 1 / 1 / 4 | `CRON_SECRET` |
| `/api/admin/*` (server actions mostly) | 2 | role + 2FA |
| `POST /api/checkin/verify`, `POST /api/checkin/admit`, `POST /api/checkin/sync`, `GET /api/checkin/offline-pack` | 2 | |
| `POST /api/enquiries/{sponsorship,exhibition}`, `POST /api/nominations`, `POST /api/uploads/sign` | 3 | Turnstile, rate limit, signed upload |

**Cross-cutting rules for every route:**
- Zod on all bodies.
- CSRF:
  - API routes require same-origin `Origin`/`Sec-Fetch-Site` headers, plus SameSite=Lax cookies.
  - Server actions get Next's built-in origin check.
  - Webhooks and cron are exempt but authenticated by signature or secret.
- Logs and Sentry: `beforeSend` scrubs request bodies, emails, phones and names. Only references and IDs are logged.

### 9. `PaymentProvider` interface
```ts
interface PaymentProvider {
  id: "razorpay" | "cashfree" | "fake";
  createOrder(i: { amountPaise: number; receipt: string; notes: Record<string,string> }): Promise<{ orderId: string }>;
  checkoutParams(i: { orderId: string; amountPaise: number; prefill: Prefill }): ClientCheckoutParams;
  verifyCheckout(i: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string, headers: Headers): NormalizedEvent;  // {eventId,type,orderId,paymentId,amount,…}
  fetchPayment(paymentId: string): Promise<NormalizedPayment>;
  refund(i: { paymentId: string; amountPaise: number; reason: string; key: string }): Promise<{ refundId: string; status: string }>;
}
```
Cashfree needs only a new adapter. The `fake` adapter powers the tests and local development.

### 10. Privacy (DPDP Act 2023 principles)
- **Collect only what's needed:** buyer contact details, attendee name/email/phone, and GSTIN/company only if supplied.
- **Purpose:** the Privacy Policy and an inline notice at checkout state the purpose (ticketing, entry, statutory invoicing).
- **Deletion requests** run through an admin tool. It anonymises personal fields but **keeps records the law requires**. GST invoices and payment records must be retained for the statutory period, so that data is minimised, not deleted. This needs the accountant's confirmation.
- **Retention:** a cron job deletes or anonymises attendee and enquiry data `[X]` months after the event.
- **Encryption** is covered in §2. **Analytics** (Phase 4) loads only after consent. The conversion funnel uses cookieless daily counts.

### 11. Testing (Phase 1 acceptance)
Vitest runs against Docker Postgres with the `fake` provider (real HMAC signing):
1. **Idempotency.** Calling verify, then `payment.authorized`, then `payment.captured`, then replaying each 5× and calling verify again concurrently gives exactly 1 Payment, 1 capture call, 1 CONFIRMED booking, `qty` tickets, 1 invoice number and 1 confirmation email job. A second *different* payment on the same booking is never captured (`DO_NOT_CAPTURE`) and issues no tickets. If it was captured anyway, a refund job is created.
2. **Oversell.** A tier with 10 seats left gets 1,000 concurrent `createBooking` calls of quantity 1 through the real pool. Exactly 10 succeed, the rest fail with SOLD_OUT, and the invariant `sold + activeHolds ≤ capacity` holds afterwards.
3. **Tampering.** A bad signature, a wrong amount (payment fetch returns a different amount), a wrong order ID, and a webhook with a modified body are all rejected and nothing is confirmed.
4. **Failure and retry.** `payment.failed` releases the hold and sets FAILED; a retry creates a new hold and order, then confirms. Hold expiry sets EXPIRED. A late authorisation with seats available is captured and confirmed. A late authorisation when sold out is **never captured**, and buyer and admin jobs are queued. If capture fails after seats were secured, the seats are returned. Every invoice number is consecutive with no gaps.
5. **Pricing.** Unit tests for exclusive and inclusive GST, fees and rounding.
6. **Layout and accessibility.** Playwright screenshots at 390, 768, 1024 and 1440 with no horizontal overflow, plus Lighthouse CI asserting accessibility ≥ 95.

After that, an end-to-end run with Razorpay **test mode** on staging (test cards, UPI, failure simulation).

### 12. Phase mapping (with your section 13 additions)
| phase | scope |
|---|---|
| **1. Public site + sales** | design system, hero, speakers row + /speakers, about, programme, tickets, FAQ, footer, sponsor logos section (seeded, hidden when empty), booking flow, holds, Razorpay test, webhooks, QR e-tickets, GST invoice PDF, emails + outbox, find my booking, cancellation *request*, legal templates marked "[Pending organiser approval]", Schema.org Event + OG/Twitter images + favicon set, field encryption, staging/prod set-up, README v1 |
| **2. Operations** | admin with Supabase Auth + mandatory 2FA, roles, audit log, overview + funnel, bookings, attendees CSV, inventory/prices/inclusions/max per order, Transactions page + CSV, refunds + credit notes, cancellation approvals, discount codes, check-in online + offline, deletion tool, CMS (speakers, sponsors, agenda, FAQ, event details) |
| **3. Enquiries + awards** | sponsorship, exhibition, nomination forms (Turnstile, uploads, per-category document rule, open/close dates with auto-close), admin views with statuses and notes |
| **4. Analytics + hardening** | consent banner, GA4 + Meta Pixel after consent, server-confirmed purchase events, sitemap, robots, Search Console, Sentry, CSP/HSTS headers, backups (Supabase PITR), retention job, SPF/DKIM/DMARC + inbox tests, runbook + admin guide, final audit |

### 13. Review against "Do not" (section 12)
| rule | how the plan meets it |
|---|---|
| Never confirm from the client | Only `confirmBooking` confirms, reached from verify (after HMAC + payment fetch) or the signed webhook. The Checkout `handler` only triggers verify. |
| Never trust client prices | Amounts come from the DB snapshot. The client sends tier, qty and an optional discount code only. |
| Never store card data | Razorpay Checkout is hosted. We store only Razorpay IDs, method and amount. |
| No personal data in QR codes, URLs or logs | The QR carries ticket ID + HMAC. URLs carry only the reference or a one-time hashed token. Sentry and logs are scrubbed. Webhook payloads (which do contain email and phone) live only in the access-restricted `PaymentEvent` table, encrypted. |
| No accent but gold | Green, amber and red appear only on staff screens (needs your approval). |
| Glassmorphism | One exception, the drag cursor, as briefed. |

### 14. Phase 1 implementation notes (where the build refines the plan)
- **Clocks:** job scheduling uses the database clock only (`now()` in SQL). Mixing app and DB clocks caused a flaky test when the Docker clock drifted, so it was removed.
- **Invoice series:** TEST-mode bookings use their own series (`TST/26-27/00001`, marked "not a tax invoice"), so testing never consumes live GST numbers.
- **Booking links:** confirmation and payment-failed emails carry a reusable link (valid until 30 days after the event); Find-my-booking links are single-use and expire in 30 minutes. Only token hashes are stored.
- **Local gateway:** `PAYMENT_PROVIDER=fake` provides a `/dev/checkout` page and a fake adapter with real HMAC signing. The env validation refuses it outside `DEPLOY_ENV=local`.
- **Speakers row:** touch devices use CSS scroll-snap. Fine pointers use JS snapping to positions that leave the first card a third cut off, because CSS can't express a negative snap offset. The row's start stays reachable.
- **Not yet wired (by design):**
  - the sponsorship and exhibition buttons open email until the Phase 3 forms exist
  - "Nominate now" shows "Nominations open soon" until dates are set
  - social links and contact details show bracketed placeholders until set


### 15. Capture job: confirmed order of operations (approved addition, 23 Oct 2026)
The order is exactly:
1. **One transaction:** seats allocated (`soldCount += qty`, hold converted) and `CAPTURE` job saved. No tickets, no invoice and no email exist at this point.
2. **Capture call** (worker, outside any transaction).
3. **Only after a successful capture**, one transaction (`confirmBooking`): booking CONFIRMED, tickets issued, invoice number allocated, confirmation email job queued.

If the capture fails, or Razorpay already auto-refunded the authorisation because the job ran past the 60-minute window:
- the seats are released and the booking is marked FAILED;
- no tickets and no invoice are issued;
- the buyer is emailed ("we couldn't complete your payment, so we didn't take it");
- admins get an alert.

Two safeguards close the remaining gaps:
- **Retries exhausted:** a capture job that exhausts its retries (8 attempts, about 45 minutes) is reconciled. The worker fetches the payment: captured → confirm; anything else → release seats as above.
- **Stuck jobs:** any capture job still pending 10 minutes after it was created raises one admin alert (de-duplicated per job). This check runs on every worker pass (per-minute cron).

Tests cover the failure path, the lapsed path, exhausted retries and the 10-minute alert.

### 16. Change request 1: vendor components, hero fit, mobile (23 Oct 2026)
- **Vendor code:** PillNav, FlexCarousel and AeroShards go in `src/components/vendor/reactbits/`, copied unedited with their CSS. Customisation lives in our wrappers plus `src/styles/vendor-overrides.css`, where every rule is scoped under our wrapper class (`.site-header`, `.speakers-carousel`, `.about-shards`). Patches, licences and package checks are recorded in `docs/VENDOR_NOTES.md`.
- **Dependencies:** pinned exactly (no ^ or ~): `ogl` (FlexCarousel) and `vgpu` (AeroShards).
- **Loading:** FlexCarousel and AeroShards load through `next/dynamic({ ssr: false })`, mounted only when their section is within 300px of the viewport (IntersectionObserver). Neither `ogl` nor `vgpu` may appear in the initial JS; verified by the bundle analyser before sign-off.
- **AeroShards gating:** no mount when any of these is true: no `navigator.gpu`, reduced motion, Save-Data, `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4`, or a narrow screen failing the capability check. It unmounts on `onError`, or if the average frame time over the first 120 frames exceeds 22ms. The still WebP frame is always underneath.
- **FlexCarousel gating:** the server-rendered HTML row is the initial HTML. The swap happens only with WebGL2, at a fixed container height (no CLS). Items are never empty (TBA padding to 6, built from the database). Images are same-origin, because the component loads them with `crossOrigin="anonymous"`. `captureWheel={false}`.
- **Scroll-spy:** `useActiveSection()` → `/#id` on the home page (rootMargin `-45% 0px -50% 0px`, undefined in the hero) and a pathname map elsewhere.
- **Tests and budgets:**
  - **Playwright** (system Chrome) at the 12 viewports asserts the hero fit: bottom edge = viewport height (±1px) at heights ≥600px; CTA bottom ≥12px above the fold; marquee not clipped; no sideways scroll. Each run saves screenshots.
  - **Lighthouse mobile budgets** (home page): Performance ≥85, LCP ≤2.5s, CLS ≤0.05, TBT ≤200ms. A second run uses 4× CPU throttling (DevTools method).

### 17. Staging and the real-Razorpay test
- **Staging** is a Vercel preview deployment of the `staging` branch, with its own Supabase project, Upstash database, Resend key and `ADMIN_ALERT_EMAIL` (env validation requires them outside local).
- **Webhooks:** preview deployments are behind Vercel's Standard Protection by default, which would reject Razorpay's webhooks. Razorpay can't send custom headers, so the webhook URL carries Vercel's automation bypass as a query parameter (documented by Vercel for exactly this case):
  `https://<staging host>/api/webhooks/razorpay?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>`
- **Production is different (decided 23 Oct 2026):** the production webhook URL must **not** carry the bypass parameter. It is `https://<production domain>/api/webhooks/razorpay`, plain. Vercel's Standard Protection doesn't cover production domains, so no bypass is needed, and a bypass secret in a live webhook URL would leak a credential into the Razorpay dashboard and its logs. Only staging uses the bypass.
- **Events to tick:** `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
- **What to confirm in test mode:**
  - the minimum `manual_expiry_period` the Orders API accepts;
  - the `refund_speed` values it accepts (`normal`, `optimum`);
  - the order of webhook events under manual capture;
  - mobile Checkout, including the UPI app hand-off.

### 18. Change request 1: implementation notes (what was built before the vendor source arrived)
- **Framer Motion removed.** The hero entrance, the mobile menu fade and the ticket summary bar are now CSS keyframes, all off under reduced motion. That took 48 KB (gzipped) of JavaScript off the home page's critical path, and the entrance no longer waits for hydration.
- **Mobile LCP budget** (Lighthouse simulated slow 4G):
  - The real LCP is ~65–95 ms (the date line, which paints at first contentful paint). The simulated value is dominated by React and Next's runtime (~150 KB gzipped), which is requested before first paint.
  - Two measures got it under budget: inline CSS (`experimental.inlineCss`), and the ₹ sign on the home page rendered in the system font, which avoids a 15 KB Manrope latin-ext download.
  - Median of 5 runs: LCP 2,391 ms (spread 1,956–2,464 ms), performance 98, CLS 0, TBT 4 ms. The margin is thin.
  - Once real stage photos are added, the LCP element will become a hero photo. They must be AVIF/WebP at ~330 px wide via next/image, and the budget re-checked.
- **CLS from a font swap** (0.055 under 4× CPU) is fixed. The hero's meta block has a fixed line structure, so its height can't change when Manrope swaps in; otherwise the strip, which takes the remaining height, would shift.
- **Scroll offsets:** sections get the specified `scroll-margin-top`. Every other scroll-into-view target gets the same offset via `:where(*)`, so a focused field never lands under the fixed header. Chrome centres on focus anyway; Safari aligns to the nearest edge.
- **Sticky booking bar:** it treats the hero CTA as gone once it slides under the fixed header (`rootMargin: -80px` on top), and hides over the tickets section and the footer.
- **Tests:**
  - Playwright (system Chrome), 16 tests: hero fit at all 12 viewports (a–d) with screenshots, the sticky bar, and the focused first error being visible.
  - `npm run test:layout`: 12 viewports × 9 pages, checking no overflow, no clipped text, touch targets ≥ 44 px and inputs ≥ 16 px.
  - `npm run test:perf`: median of 5 runs, plus a 4× CPU DevTools run.
