# Beyond the Limits — A Business Conclave 2026

Official website and ticketing platform. Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 7 on PostgreSQL (Supabase) · Razorpay · Resend.

| Phase | Scope | Status |
|---|---|---|
| 1 | Public site, ticket sales, payments, e-tickets, emails, legal templates, SEO basics | **Built** |
| 2 | Admin, refunds, CSV exports, check-in scanner, discount codes | Next |
| 3 | Sponsorship, exhibition and nomination forms | Planned |
| 4 | Analytics with consent, security headers, monitoring, final audit | Planned |

Design and technical plans: [docs/design-plan.md](docs/design-plan.md), [docs/technical-plan.md](docs/technical-plan.md).

---

## 1. Local setup

Requirements: Node 22+, Docker Desktop.

```bash
npm install                    # also generates the Prisma client
cp .env.example .env           # then fill the secrets (see below)
npm run db:up                  # Postgres 17 on localhost:5544 (plus a btl_test database)
npx prisma migrate deploy      # apply migrations
npm run db:seed                # event facts, passes, placeholders, legal templates
npm run dev                    # http://localhost:3000
```

Generate each secret with `openssl rand -base64 32`. For `PII_ENC_KEYS`, use `k1:<that value>`.

Locally, set `PAYMENT_PROVIDER=fake`. "Pay" then opens a **local test gateway** (`/dev/checkout`) with *Authorise* and *Fail* buttons, and runs the same server flow as Razorpay (signature check, seat securing, server capture, confirmation). Without `RESEND_API_KEY`, emails and their PDF attachments are written to `.dev-mail/` instead of being sent.

## 2. Tests

```bash
npm test                       # 35 integration/unit tests against the btl_test database
npm run build && npm start     # then, in another terminal:
BASE_URL=http://localhost:3000 npm run test:layout   # 390/768/1024/1440px, no overflow, reduced motion
BASE_URL=http://localhost:3000 npm run test:a11y     # Lighthouse accessibility ≥ 95, mobile + desktop
```

`npm test` covers the Phase 1 acceptance checks:
- **Idempotency:** paying twice or replaying webhooks issues exactly one set of tickets.
- **Overselling:** 1,000 concurrent requests for the last 10 seats never oversell.
- **Tampering:** a tampered signature, amount, order or webhook body is rejected.
- **Failures:** a failed payment releases the hold and allows a retry, and late payments for sold-out passes are never captured.
- **Invoices:** invoice numbers have no gaps.
- **Go-live gate:** live mode is refused until the checklist is complete.
- **Basics:** pricing in paise, GSTIN checksums, encryption and blind indexes, QR tokens, and booking access.

## 3. Environment variables

Every variable is documented in [.env.example](.env.example). The ones that matter most:

| Variable | Notes |
|---|---|
| `DEPLOY_ENV` | `local`, `staging` or `production`. Live Razorpay keys are **refused** unless this is `production`. |
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooled URL for the app; direct URL for migrations. |
| `PII_ENC_KEYS`, `PII_ENC_ACTIVE_KEY` | AES-256-GCM keys for personal data. **Losing them makes attendee data unreadable.** Store them in a password manager as well as in Vercel. |
| `PII_INDEX_KEY` | Keyed hash for searching by email or phone. Changing it requires re-indexing. |
| `QR_SECRET` | Signs ticket QR codes. Changing it invalidates every issued ticket. |
| `RAZORPAY_TEST_*` | Staging and production (production starts in TEST mode). |
| `RAZORPAY_LIVE_*` | Production only. Used only after the go-live gate passes. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_ALERT_EMAIL` | `ADMIN_ALERT_EMAIL` receives automatic-refund, uncaptured-payment and failed-job alerts. |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `.env.example` holds Cloudflare's always-pass test keys. |
| `UPSTASH_REDIS_REST_*` | Rate limiting; required on staging and production. |
| `CRON_SECRET` | Vercel Cron authenticates to `/api/cron/*` with it. |

## 4. Environments and deployment

Every account (domain, Vercel, Supabase, Razorpay, Resend, Upstash, Cloudflare, GA4) is opened **by the organiser**, and the developers are invited as members.

| | Staging | Production |
|---|---|---|
| Vercel | Preview deployments of the `staging` branch | `main` |
| Supabase | Its own project | Its own project (Pro plan, daily backups) |
| Razorpay | Test keys only | Test keys first, then live keys after the go-live gate |
| Resend | Test sending domain | Organiser domain with SPF, DKIM and DMARC |

### First deployment
1. **Supabase:** create the project (Pro plan for production), then copy the pooled connection string to `DATABASE_URL` and the direct one to `DIRECT_URL`.
2. **Vercel:** create the project, set every variable from `.env.example` per environment, and add the domain. Vercel Pro is required for the per-minute cron in `vercel.json`.
3. **Migrations:** run `npx prisma migrate deploy` with the environment's `DIRECT_URL`, then `npm run db:seed` **once** per database.
4. **Razorpay (test mode first):** Settings → Webhooks → add `https://<domain>/api/webhooks/razorpay`.
   - **Events:** `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
   - **Secret:** set it as `RAZORPAY_TEST_WEBHOOK_SECRET`.
   - **Capture:** orders are created with **manual capture**, which overrides the dashboard auto-capture setting. The server captures a payment only after seats are secured.
5. **Resend:** add the sending domain and publish the SPF, DKIM and DMARC DNS records Resend shows. Start DMARC at `p=none` and move to `p=quarantine` after two clean weeks. Send test emails to Gmail and Outlook before launch.

## 5. Switching Razorpay to live

Live payments stay blocked until the **go-live checklist** passes. The check runs on the server and cannot be bypassed:
- organiser legal name, valid GSTIN, GST state code, SAC code
- Privacy Policy, Terms and Refund Policy each **marked approved**
- inclusions set for every pass
- seat split confirmed (the seeded 600 / 300 / 100 is a placeholder)

Steps:
1. Complete the checklist in the admin (Phase 2).
2. Complete Razorpay KYC and activation. Razorpay requires the policy and contact pages, which already exist at `/privacy`, `/terms` and `/refund-policy`.
3. Add `RAZORPAY_LIVE_KEY_ID`, `RAZORPAY_LIVE_KEY_SECRET` and `RAZORPAY_LIVE_WEBHOOK_SECRET` to **Production only** and redeploy.
4. In the **live** Razorpay dashboard, add the same webhook URL and events, using the live webhook secret.
5. In the admin, switch payments to LIVE. This is refused if any checklist item is missing.
6. Buy one Standard Pass with a real card or UPI, check the email, PDF ticket and invoice (series `BTL/26-27/…`), then refund it from the admin.

Test-mode bookings use the invoice series `TST/…` and say "TEST TICKET: NOT VALID FOR ENTRY", so they never consume live GST invoice numbers.

## 6. Runbook

**A buyer says they paid but the page still says "Confirming your payment".**
1. Look the booking up by reference: `Payment.decision` should be `CAPTURE`.
2. Check the `Job` table for its `CAPTURE` job: `lastError`, `attempts`, `runAt`.
3. If the Vercel cron has stopped, nothing gets processed. Check *Vercel → Cron Jobs*, or call `GET /api/cron/jobs` with `Authorization: Bearer $CRON_SECRET`.

Capture retries back off for up to 8 attempts, and then an admin alert is sent.

**Razorpay disabled our webhook.** Razorpay retries failed webhooks for 24 hours, then disables the endpoint.
1. Fix the cause, then re-enable the endpoint in *Razorpay → Settings → Webhooks*.
2. Bookings are not lost meanwhile: the browser's verify call secures and captures payments on its own.
3. Replayed webhooks are safe, because events are de-duplicated by `x-razorpay-event-id`.

**An "Automatic refund" or "Payment not captured" alert arrives.** This is expected behaviour:
- **Payment not captured:** a buyer paid twice, or paid after their hold expired and the pass sold out. The payment was **not captured**, and Razorpay returns it automatically after 60 minutes. The buyer has already been emailed.
- **Automatic refund:** a duplicate payment was captured outside our flow (for example from the dashboard), so it was refunded in full automatically.

**Resending tickets.** Run `npm run resend-tickets -- BTL26-XXXXXX` with production env vars. The admin gets a button for this in Phase 2.

**Refunds.** Admin-initiated refunds, credit notes and cancellation approvals arrive in Phase 2. Until then, refund from the Razorpay dashboard. The `refund.processed` webhook records it, but ticket invalidation for those refunds ships with Phase 2.

**A buyer lost their email.** Send them to `/booking/find`. They enter their email and reference, and get a one-time link valid for 30 minutes.

**Rotating the encryption key.**
1. Add `k2:<new key>` to `PII_ENC_KEYS` and set `PII_ENC_ACTIVE_KEY=k2`. New writes use k2, and old rows still decrypt with k1.
2. A re-encryption script is part of Phase 4 hardening.

## 7. Guides
- [Check-in staff guide](docs/checkin-staff-guide.md) (the scanner ships in Phase 2)
- Admin user guide: written with the admin in Phase 2.

## 8. Security and privacy notes
- **Money:** every amount is integer paise and recomputed on the server. The client sends only the pass, the quantity and people's details.
- **Personal data:** names, emails, phones, GSTINs and gateway payloads are encrypted in the database. Search uses keyed blind indexes.
- **Never exposed:** personal data never appears in QR codes, URLs or logs. QR codes carry a ticket ID and a signature.
- **Card data:** Razorpay processes all of it; we store only Razorpay IDs.
- **Policies:** the legal pages are **templates** marked "[Pending organiser approval]". They are not legal advice and must be reviewed by the organiser's lawyer.
