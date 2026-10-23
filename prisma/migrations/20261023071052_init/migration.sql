-- CreateEnum
CREATE TYPE "TierCode" AS ENUM ('STANDARD', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AUTHORIZED', 'CAPTURED', 'FAILED', 'LAPSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentDecision" AS ENUM ('PENDING', 'CAPTURE', 'DO_NOT_CAPTURE', 'REFUND');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('EMAIL', 'CAPTURE', 'REFUND', 'ADMIN_ALERT');

-- CreateEnum
CREATE TYPE "PaymentsMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "FeeMode" AS ENUM ('NONE', 'FIXED_PER_TICKET', 'PERCENT');

-- CreateEnum
CREATE TYPE "LegalKind" AS ENUM ('PRIVACY', 'TERMS', 'REFUND');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FunnelStep" AS ENUM ('VISIT', 'CHECKOUT_STARTED', 'PAID');

-- CreateTable
CREATE TABLE "EventSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "capacityTotal" INTEGER NOT NULL DEFAULT 1000,
    "capacityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "maxTicketsPerOrder" INTEGER NOT NULL DEFAULT 10,
    "holdMinutes" INTEGER NOT NULL DEFAULT 15,
    "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
    "pricesIncludeGst" BOOLEAN NOT NULL DEFAULT false,
    "taxConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "feeMode" "FeeMode" NOT NULL DEFAULT 'NONE',
    "feeValue" INTEGER NOT NULL DEFAULT 0,
    "feeTaxable" BOOLEAN NOT NULL DEFAULT true,
    "organiserLegalName" TEXT,
    "organiserGstin" TEXT,
    "organiserAddress" TEXT,
    "organiserStateCode" TEXT,
    "sacCode" TEXT,
    "nominationsOpenAt" TIMESTAMP(3),
    "nominationsCloseAt" TIMESTAMP(3),
    "retentionMonths" INTEGER,
    "paymentsMode" "PaymentsMode" NOT NULL DEFAULT 'TEST',
    "captureWindowMins" INTEGER NOT NULL DEFAULT 60,
    "refundSpeed" TEXT NOT NULL DEFAULT 'normal',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "code" "TierCode" NOT NULL,
    "name" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "inclusions" TEXT[],
    "salesOpen" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "serialPrefix" TEXT NOT NULL,
    "lastSerial" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "tierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyerNameEnc" TEXT NOT NULL,
    "buyerEmailEnc" TEXT NOT NULL,
    "buyerEmailIdx" TEXT NOT NULL,
    "buyerPhoneEnc" TEXT NOT NULL,
    "buyerPhoneIdx" TEXT NOT NULL,
    "buyerCompanyEnc" TEXT,
    "buyerGstinEnc" TEXT,
    "unitPricePaise" INTEGER NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "feePaise" INTEGER NOT NULL,
    "feeTaxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "gstRateBps" INTEGER NOT NULL,
    "pricesIncludeGst" BOOLEAN NOT NULL,
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "paymentsMode" "PaymentsMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatHold" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "nameEnc" TEXT NOT NULL,
    "emailEnc" TEXT NOT NULL,
    "emailIdx" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "phoneIdx" TEXT NOT NULL,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "attemptId" TEXT,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "decision" "PaymentDecision" NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "seatsSecuredAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partiesEnc" TEXT NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL,
    "sgstPaise" INTEGER NOT NULL,
    "igstPaise" INTEGER NOT NULL,
    "feePaise" INTEGER NOT NULL,
    "feeTaxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "isTest" BOOLEAN NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "series" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("series","financialYear")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providerEventId" TEXT,
    "bookingId" TEXT,
    "providerPaymentId" TEXT,
    "providerOrderId" TEXT,
    "amountPaise" INTEGER,
    "signatureValid" BOOLEAN NOT NULL,
    "outcome" TEXT,
    "payloadEnc" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reasonEnc" TEXT NOT NULL,
    "status" "CancellationStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelCount" (
    "day" DATE NOT NULL,
    "step" "FunnelStep" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FunnelCount_pkey" PRIMARY KEY ("day","step")
);

-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "sessionTitle" TEXT,
    "sessionTime" TEXT,
    "photoUrl" TEXT,
    "xUrl" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tierOrder" INTEGER NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eligibility" TEXT,
    "requiresDocuments" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AwardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceNote" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ExhibitionPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "kind" "LegalKind" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketTier_code_key" ON "TicketTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_buyerEmailIdx_idx" ON "Booking"("buyerEmailIdx");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SeatHold_tierId_expiresAt_idx" ON "SeatHold"("tierId", "expiresAt");

-- CreateIndex
CREATE INDEX "SeatHold_bookingId_idx" ON "SeatHold"("bookingId");

-- CreateIndex
CREATE INDEX "Attendee_emailIdx_idx" ON "Attendee"("emailIdx");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_bookingId_position_key" ON "Attendee"("bookingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerOrderId_key" ON "PaymentAttempt"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_bookingId_idx" ON "PaymentAttempt"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_attendeeId_key" ON "Ticket"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_serial_key" ON "Ticket"("serial");

-- CreateIndex
CREATE INDEX "Ticket_bookingId_idx" ON "Ticket"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_key" ON "Invoice"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_series_financialYear_seq_key" ON "Invoice"("series", "financialYear", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_receivedAt_idx" ON "PaymentEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_bookingId_idx" ON "PaymentEvent"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_dedupeKey_key" ON "Job"("dedupeKey");

-- CreateIndex
CREATE INDEX "Job_doneAt_failedAt_runAt_idx" ON "Job"("doneAt", "failedAt", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccessToken_tokenHash_key" ON "BookingAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_idx" ON "CancellationRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_slug_key" ON "Speaker"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_kind_version_key" ON "LegalDocument"("kind", "version");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccessToken" ADD CONSTRAINT "BookingAccessToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guards (belt and braces on top of the row-lock logic).
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_sold_within_capacity" CHECK ("soldCount" >= 0 AND "soldCount" <= "capacity");
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_price_nonnegative" CHECK ("pricePaise" >= 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_total_nonnegative" CHECK ("totalPaise" >= 0);
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "EventSettings" ADD CONSTRAINT "EventSettings_singleton" CHECK ("id" = 1);
