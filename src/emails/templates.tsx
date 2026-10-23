import { Cta, H1, Layout, P, Rows } from "./Layout";

export type BookingSummary = {
  firstName: string;
  reference: string;
  tierName: string;
  quantity: number;
  total: string;
  dateLabel: string;
  venueLabel: string;
};

export function BookingConfirmed({ b, bookingUrl, invoiceNumber }: { b: BookingSummary; bookingUrl: string; invoiceNumber: string | null }) {
  return (
    <Layout preview={`You're in. Booking ${b.reference} is confirmed.`}>
      <H1>You&apos;re in, {b.firstName}.</H1>
      <P>Your booking is confirmed. Each attendee&apos;s e-ticket is attached as a separate PDF. Forward each one to its attendee; every ticket has its own QR code and can be scanned once.</P>
      <Rows
        rows={[
          ["Booking reference", b.reference],
          ["Pass", `${b.tierName} × ${b.quantity}`],
          ["Total paid", b.total],
          ["Date", b.dateLabel],
          ["Venue", b.venueLabel],
          ...(invoiceNumber ? ([["GST invoice", `${invoiceNumber} (attached)`]] as [string, string][]) : []),
        ]}
      />
      <Cta href={bookingUrl}>View your booking</Cta>
      <P> </P>
      <P>From the booking page you can download your tickets again or request a cancellation under the Refund and Cancellation Policy.</P>
    </Layout>
  );
}

export function PaymentFailed({ b, retryUrl }: { b: BookingSummary; retryUrl: string }) {
  return (
    <Layout preview={`Your payment for ${b.reference} didn't go through.`}>
      <H1>Your payment didn&apos;t go through</H1>
      <P>We couldn&apos;t complete the payment for booking {b.reference} ({b.tierName} × {b.quantity}). No money was taken. If your bank placed a temporary hold, it will release it automatically.</P>
      <P>You can try again while seats are still available.</P>
      <Cta href={retryUrl}>Try payment again</Cta>
    </Layout>
  );
}

export function PaymentNotTaken({ b, amount, reason, windowMins }: { b: BookingSummary; amount: string; reason: string; windowMins: number }) {
  const why =
    reason === "duplicate_payment"
      ? "this booking had already been paid for"
      : "the seats on your booking were released before the payment reached us, and that pass has since sold out";
  return (
    <Layout preview={`We didn't take your payment of ${amount}.`}>
      <H1>We didn&apos;t take your payment</H1>
      <P>
        We received a payment authorisation of {amount} for booking {b.reference}, but we didn&apos;t take it because {why}. You have not been charged.
      </P>
      <P>Razorpay releases the authorisation automatically within about {Math.ceil(windowMins / 60)} hour(s). Depending on your bank, the hold can take a few working days to disappear from your statement.</P>
    </Layout>
  );
}

export function PaymentRefunded({ b, amount }: { b: BookingSummary; amount: string }) {
  return (
    <Layout preview={`We're refunding ${amount}.`}>
      <H1>We&apos;re refunding a duplicate payment</H1>
      <P>
        A second payment of {amount} was taken for booking {b.reference}, which was already paid for. We&apos;ve started a full refund to the original payment method. Refunds usually arrive within 5–7 working days.
      </P>
      <P>Your booking and tickets are unaffected.</P>
    </Layout>
  );
}

export function AccessLink({ reference, url, minutes }: { reference: string; url: string; minutes: number }) {
  return (
    <Layout preview={`Your link to booking ${reference}`}>
      <H1>View your booking</H1>
      <P>Use this link to view booking {reference}, download your tickets again or request a cancellation. It works once and expires in {minutes} minutes.</P>
      <Cta href={url}>Open my booking</Cta>
      <P> </P>
      <P>If you didn&apos;t ask for this, you can ignore this email. Nobody can see your booking without this link.</P>
    </Layout>
  );
}

export function CancellationReceived({ b }: { b: BookingSummary }) {
  return (
    <Layout preview={`We've received your cancellation request for ${b.reference}.`}>
      <H1>Cancellation request received</H1>
      <P>We&apos;ve received your request to cancel booking {b.reference}. The team will review it under the Refund and Cancellation Policy and email you with the outcome. Your tickets stay valid until then.</P>
    </Layout>
  );
}
