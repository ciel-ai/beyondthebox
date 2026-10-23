import { hasBookingAccess } from "@/server/access";
import { db } from "@/server/db";
import { ticketPdfs } from "@/server/documents";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, select: { bookingId: true, status: true, booking: { select: { reference: true } } } });
  if (!t || t.status !== "VALID" || !(await hasBookingAccess(t.booking.reference))) return new Response("Not found", { status: 404 });
  const [pdf] = await ticketPdfs(t.bookingId, id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.content), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
