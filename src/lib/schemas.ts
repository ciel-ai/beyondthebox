import { z } from "zod";
import { isValidGstin } from "./gst";

/** Shared by the checkout form (client) and the API (server). Messages say exactly what to fix. */

export const TIER_CODES = ["STANDARD", "PREMIUM", "VIP"] as const;
export type TierCodeValue = (typeof TIER_CODES)[number];

const name = z
  .string()
  .trim()
  .min(2, "Enter the full name as it should appear on the ticket.")
  .max(80, "Keep the name under 80 characters.");

const email = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .max(254, "That email address is too long.")
  .email("Enter an email address in the format name@example.com.");

const phone = z
  .string()
  .trim()
  .min(1, "Enter a phone number.")
  .regex(/^\+?[\d\s()-]+$/, "Use digits only, with an optional + and country code.")
  .refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 15;
  }, "Enter a 10-digit mobile number, or include the country code for numbers outside India.");

export const attendeeSchema = z.object({ name, email, phone });

export const buyerSchema = z.object({
  name,
  email,
  phone,
  company: z.string().trim().max(120, "Keep the company name under 120 characters.").optional().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidGstin(v), "Enter a valid 15-character GSTIN, e.g. 29ABCDE1234F1Z5."),
});

export const createBookingSchema = z
  .object({
    tier: z.enum(TIER_CODES, { message: "Choose a pass." }),
    quantity: z.number().int().min(1, "Choose at least one ticket.").max(50),
    buyer: buyerSchema,
    attendees: z.array(attendeeSchema).min(1),
    turnstileToken: z.string().min(1, "Complete the security check."),
  })
  .superRefine((v, ctx) => {
    if (v.attendees.length !== v.quantity) {
      ctx.addIssue({ code: "custom", path: ["attendees"], message: "Add details for every ticket." });
    }
    if (v.buyer.gstin && !v.buyer.company) {
      ctx.addIssue({ code: "custom", path: ["buyer", "company"], message: "Enter the company name registered to this GSTIN." });
    }
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const payBookingSchema = z.object({
  termsAccepted: z.literal(true, { message: "Tick the box to agree to the Terms and the Refund Policy." }),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

export const findBookingSchema = z.object({
  email,
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BTL26-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/, "Enter the reference exactly as shown in your email, e.g. BTL26-7F3K9Q."),
  turnstileToken: z.string().min(1, "Complete the security check."),
});

export const cancellationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Tell us briefly why you'd like to cancel (at least 10 characters).")
    .max(1000, "Keep the reason under 1,000 characters."),
});

/** Flattens Zod issues into { "buyer.email": "message" } for inline errors. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
