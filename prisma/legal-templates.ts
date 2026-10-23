/**
 * Starting templates only. NOT legal advice: each must be reviewed by the organiser and
 * their lawyer, then marked approved in the admin (part of the go-live gate).
 */
import type { LegalKind } from "../src/generated/prisma/client";

const PENDING = "**[Pending organiser approval]** This is a template and has not been reviewed or approved.";

export const LEGAL_TEMPLATES: { kind: LegalKind; version: string; title: string; body: string }[] = [
  {
    kind: "PRIVACY",
    version: "0.1",
    title: "Privacy Policy",
    body: `${PENDING}

## Who we are
Beyond the Limits — A Business Conclave 2026 is organised by [Organiser legal name], [Registered address] ("we", "us"). Contact for privacy matters: [email].

## What we collect, and why
We collect only what we need to run the event, in line with the Digital Personal Data Protection Act, 2023:
- **Booking details**: the buyer's name, email and phone, to issue tickets, send confirmations and contact you about your booking.
- **Attendee details**: each attendee's name, email and phone, to issue a personal ticket and admit them at the entrance.
- **Business details (optional)**: company name and GSTIN, only if you ask for a GST invoice, to issue a tax invoice as required by law.
- **Payment references**: payment IDs and amounts from Razorpay. We never see or store your card, UPI or bank details; Razorpay processes them.
- **Enquiries and nominations**: the details you submit in our forms, to respond to you and to run the awards.

## How we protect it
Personal data is encrypted in our database, access is limited to authorised organisers, and we never put personal data in ticket QR codes or web addresses.

## Who we share it with
Only service providers that help us run the event: Razorpay (payments), Resend (email), Supabase (hosting and database), Cloudflare (spam protection) and Vercel (website hosting). [Add any others.] We do not sell your data.

## How long we keep it
Attendee and enquiry data is deleted or anonymised [X] months after the event. Invoices and payment records are kept for the period required by tax law.

## Your rights
You can ask us to access, correct or erase your personal data, or withdraw consent, by writing to [email]. We will respond within [X] days. Where the law requires us to keep a record (for example a tax invoice), we will tell you what we have to keep and why.

## Cookies and analytics
We use one essential cookie to let you view your booking. Analytics cookies are only set if you agree to them.

## Grievance officer
[Name], [email], [address].

_Last updated: [Date]_`,
  },
  {
    kind: "TERMS",
    version: "0.1",
    title: "Terms and Conditions",
    body: `${PENDING}

## The event
Beyond the Limits — A Business Conclave 2026 takes place on 20 December 2026 at a venue to be announced. The programme, speakers and venue may change; we will tell ticket holders about material changes.

## Tickets
- Each ticket admits one named attendee and carries a unique QR code that can be scanned once.
- Tickets are issued only after payment is confirmed by our payment provider.
- Up to [10] tickets per order.
- Tickets may not be resold for profit. [Add transfer rules.]

## Prices and taxes
Prices are shown in Indian rupees. GST is [added at checkout / included] as shown before payment. A tax invoice is issued for every booking.

## Entry
Bring a valid photo ID matching the ticket name. [Add age, conduct and security rules.] We may refuse entry to anyone breaching these terms or venue rules.

## Cancellations and refunds
See the Refund and Cancellation Policy.

## Liability
[Liability wording to be provided by the organiser's lawyer.]

## Contact
[Organiser legal name], [Registered address], [email], [phone].

_Last updated: [Date]_`,
  },
  {
    kind: "REFUND",
    version: "0.1",
    title: "Refund and Cancellation Policy",
    body: `${PENDING}

## Cancelling your booking
You can request a cancellation from your booking page (use **Find my booking** if you need a new link). Every request is reviewed by the organiser; nothing is refunded automatically.

## Refund amounts
- Requests received [X] days or more before the event: [refund amount].
- Requests received less than [X] days before the event: [refund amount].
- [Convenience fees: refundable / non-refundable.]

## If the event is cancelled or postponed
[Wording to be provided by the organiser.]

## How refunds are paid
Approved refunds go back to the original payment method through Razorpay, usually within 5–7 working days of approval.

## Payments we don't take
If a payment reaches us after your seats were released, or you pay twice for the same booking, we don't take the payment. Your bank releases the hold automatically. If a duplicate payment was already taken, we refund it in full automatically.

## Contact
[email], [phone].

_Last updated: [Date]_`,
  },
];
