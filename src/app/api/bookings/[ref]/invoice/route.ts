import { hasBookingAccess } from "@/server/access";
import { isBookingReference } from "@/server/crypto";
import { db } from "@/server/db";
import { invoicePdf } from "@/server/documents";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!isBookingReference(ref) || !(await hasBookingAccess(ref))) return new Response("Not found", { status: 404 });
  const b = await db.booking.findUnique({ where: { reference: ref }, select: { id: true } });
  const pdf = b && (await invoicePdf(b.id));
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.content), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
