import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { formatPaise } from "@/lib/pricing";
import {
  AccessLink,
  BookingConfirmed,
  CancellationReceived,
  PaymentFailed,
  PaymentNotTaken,
  PaymentRefunded,
  type BookingSummary,
} from "@/emails/templates";
import { accessUrl, createAccessToken } from "../access";
import { decrypt } from "../crypto";
import { db } from "../db";
import { eventDateLabel, invoicePdf, ticketPdfs, venueLabel } from "../documents";
import { env } from "../env";
import type { JobPayload } from "../outbox";
import { getSettings } from "../settings";
import { deliver } from "./mailer";

export const FIND_LINK_MINUTES = 30;

async function html(el: ReactElement) {
  return { html: await render(el), text: await render(el, { plainText: true }) };
}

export async function sendTemplate(job: Extract<JobPayload, { kind: "EMAIL" }>, jobId: string) {
  const settings = await getSettings();
  const booking = await db.booking.findUniqueOrThrow({ where: { id: job.bookingId }, include: { tier: true, invoice: true } });
  const to = decrypt(booking.buyerEmailEnc);
  const b: BookingSummary = {
    firstName: decrypt(booking.buyerNameEnc).split(" ")[0] ?? "",
    reference: booking.reference,
    tierName: booking.tier.name,
    quantity: booking.quantity,
    total: formatPaise(booking.totalPaise),
    dateLabel: eventDateLabel(settings.startsAt),
    venueLabel: venueLabel(settings.venueName),
  };
  const payment = job.paymentId ? await db.payment.findUnique({ where: { id: job.paymentId } }) : null;
  const key = `${job.template}:${job.bookingId}:${job.paymentId ?? ""}`;

  switch (job.template) {
    case "booking_confirmed": {
      // Reusable until 30 days after the event.
      const minutesUntilExpiry = Math.max(1440, Math.ceil((settings.startsAt.getTime() - Date.now()) / 60_000) + 30 * 1440);
      const token = await createAccessToken(booking.id, { minutes: minutesUntilExpiry, multiUse: true });
      const tickets = await ticketPdfs(booking.id);
      const invoice = await invoicePdf(booking.id);
      const body = await html(<BookingConfirmed b={b} bookingUrl={accessUrl(token)} invoiceNumber={booking.invoice?.number ?? null} />);
      return deliver({
        to,
        subject: `Booking confirmed: ${booking.reference} · Beyond the Limits`,
        ...body,
        attachments: [...tickets.map((t) => ({ filename: t.filename, content: t.content })), ...(invoice ? [invoice] : [])],
        idempotencyKey: key,
        tag: job.template,
      });
    }
    case "payment_failed": {
      const token = await createAccessToken(booking.id, { minutes: 7 * 1440, multiUse: true });
      const body = await html(<PaymentFailed b={b} retryUrl={accessUrl(token)} />);
      return deliver({ to, subject: `Payment didn't go through: ${booking.reference}`, ...body, idempotencyKey: key, tag: job.template });
    }
    case "payment_not_taken": {
      const body = await html(
        <PaymentNotTaken
          b={b}
          amount={formatPaise(payment?.amountPaise ?? booking.totalPaise)}
          reason={payment?.decisionReason ?? ""}
          windowMins={settings.captureWindowMins}
        />,
      );
      return deliver({ to, subject: `We didn't take your payment: ${booking.reference}`, ...body, idempotencyKey: key, tag: job.template });
    }
    case "payment_refunded": {
      const body = await html(<PaymentRefunded b={b} amount={formatPaise(payment?.amountPaise ?? booking.totalPaise)} />);
      return deliver({ to, subject: `Refund started: ${booking.reference}`, ...body, idempotencyKey: key, tag: job.template });
    }
    case "booking_access_link": {
      const token = await createAccessToken(booking.id, { minutes: FIND_LINK_MINUTES, multiUse: false });
      const body = await html(<AccessLink reference={booking.reference} url={accessUrl(token)} minutes={FIND_LINK_MINUTES} />);
      // Each request is its own job, so the job ID keeps retries of that job from sending twice.
      return deliver({ to, subject: `Your link to booking ${booking.reference}`, ...body, idempotencyKey: `${key}:${jobId}`, tag: job.template });
    }
    case "cancellation_received": {
      const body = await html(<CancellationReceived b={b} />);
      return deliver({ to, subject: `Cancellation request received: ${booking.reference}`, ...body, idempotencyKey: key, tag: job.template });
    }
  }
}

export async function sendAdminAlert(subject: string, lines: string[], jobId: string) {
  const e = env();
  const to = e.ADMIN_ALERT_EMAIL ?? "admin-alerts@localhost";
  const text = `${lines.join("\n")}\n\n(${e.DEPLOY_ENV})`;
  const htmlBody = `<pre style="font:14px/1.5 ui-monospace,monospace">${lines.map((l) => l.replace(/[<>&]/g, "")).join("\n")}</pre>`;
  return deliver({ to, subject: `[BTL ${e.DEPLOY_ENV}] ${subject}`, html: htmlBody, text, idempotencyKey: `alert:${jobId}`, tag: "admin_alert" });
}
