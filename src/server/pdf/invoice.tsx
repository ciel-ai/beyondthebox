import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatRate } from "@/lib/pricing";
import { pdfMoney, registerPdfFonts } from "./fonts";

export type InvoicePdfData = {
  number: string;
  issuedAt: Date;
  isTest: boolean;
  taxConfirmed: boolean;
  seller: { legalName: string; gstin: string; address: string; stateCode: string; sac: string };
  buyer: { name: string; email: string; company: string | null; gstin: string | null };
  line: { description: string; quantity: number; unitPaise: number };
  gstRateBps: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  totalPaise: number;
  reference: string;
};

// Light document: black text only (gold is never used on a light background).
const s = StyleSheet.create({
  page: { fontFamily: "Manrope", fontSize: 9.5, padding: 40, color: "#000000" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontFamily: "Anton", fontSize: 20, textTransform: "uppercase" },
  docTitle: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  muted: { color: "#555555" },
  parties: { flexDirection: "row", gap: 24, marginTop: 24 },
  party: { flex: 1, borderTopWidth: 1, borderTopColor: "#000000", paddingTop: 8, gap: 2 },
  h: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  table: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#000000" },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#BBBBBB" },
  c1: { flex: 4 },
  c2: { flex: 1, textAlign: "right" },
  c3: { flex: 1.6, textAlign: "right" },
  totals: { marginTop: 12, marginLeft: "50%", gap: 4 },
  tRow: { flexDirection: "row", justifyContent: "space-between" },
  grand: { borderTopWidth: 1, borderTopColor: "#000000", paddingTop: 6, marginTop: 4, fontWeight: 700, fontSize: 11 },
  note: { marginTop: 28, fontSize: 8, color: "#555555", gap: 3 },
  stamp: { marginTop: 8, padding: 6, borderWidth: 1, borderColor: "#000000", fontWeight: 700, textAlign: "center" },
});

export async function renderInvoicePdf(d: InvoicePdfData) {
  registerPdfFonts();
  const half = formatRate(d.gstRateBps / 2);
  const full = formatRate(d.gstRateBps);
  const date = d.issuedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  return renderToBuffer(
    <Document title={`Invoice ${d.number}`} author={d.seller.legalName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>Beyond the Limits</Text>
            <Text style={s.muted}>A Business Conclave 2026</Text>
          </View>
          <View>
            <Text style={s.docTitle}>{d.isTest ? "TEST INVOICE" : "TAX INVOICE"}</Text>
            <Text style={{ textAlign: "right" }}>No. {d.number}</Text>
            <Text style={{ textAlign: "right" }}>Date {date}</Text>
            <Text style={{ textAlign: "right" }}>Booking {d.reference}</Text>
          </View>
        </View>
        {d.isTest && <Text style={s.stamp}>TEST MODE — NOT A TAX INVOICE. No payment was taken from a real account.</Text>}

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.h}>Supplier</Text>
            <Text style={{ fontWeight: 600 }}>{d.seller.legalName}</Text>
            <Text>{d.seller.address}</Text>
            <Text>GSTIN {d.seller.gstin}</Text>
            <Text>State code {d.seller.stateCode}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.h}>Billed to</Text>
            <Text style={{ fontWeight: 600 }}>{d.buyer.company ?? d.buyer.name}</Text>
            {d.buyer.company && <Text>Attn. {d.buyer.name}</Text>}
            <Text>{d.buyer.email}</Text>
            {d.buyer.gstin && <Text>GSTIN {d.buyer.gstin}</Text>}
            <Text>Place of supply: state code {d.seller.stateCode}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.row, { fontWeight: 700 }]}>
            <Text style={s.c1}>Description (SAC {d.seller.sac})</Text>
            <Text style={s.c2}>Qty</Text>
            <Text style={s.c3}>Rate</Text>
            <Text style={s.c3}>Amount</Text>
          </View>
          <View style={s.row}>
            <Text style={s.c1}>{d.line.description}</Text>
            <Text style={s.c2}>{d.line.quantity}</Text>
            <Text style={s.c3}>{pdfMoney(d.line.unitPaise)}</Text>
            <Text style={s.c3}>{pdfMoney(d.line.unitPaise * d.line.quantity)}</Text>
          </View>
          {d.feePaise > 0 && (
            <View style={s.row}>
              <Text style={s.c1}>Convenience fee</Text>
              <Text style={s.c2}>1</Text>
              <Text style={s.c3}>{pdfMoney(d.feePaise)}</Text>
              <Text style={s.c3}>{pdfMoney(d.feePaise)}</Text>
            </View>
          )}
        </View>

        <View style={s.totals}>
          {d.discountPaise > 0 && (
            <View style={s.tRow}>
              <Text>Discount</Text>
              <Text>− {pdfMoney(d.discountPaise)}</Text>
            </View>
          )}
          <View style={s.tRow}>
            <Text>Taxable value</Text>
            <Text>{pdfMoney(d.taxablePaise + d.feePaise)}</Text>
          </View>
          {d.igstPaise > 0 ? (
            <View style={s.tRow}>
              <Text>IGST {full}</Text>
              <Text>{pdfMoney(d.igstPaise)}</Text>
            </View>
          ) : (
            <>
              <View style={s.tRow}>
                <Text>CGST {half}</Text>
                <Text>{pdfMoney(d.cgstPaise)}</Text>
              </View>
              <View style={s.tRow}>
                <Text>SGST {half}</Text>
                <Text>{pdfMoney(d.sgstPaise)}</Text>
              </View>
            </>
          )}
          <View style={[s.tRow, s.grand]}>
            <Text>Total</Text>
            <Text>{pdfMoney(d.totalPaise)}</Text>
          </View>
        </View>

        <View style={s.note}>
          <Text>This is a computer-generated invoice and does not need a signature.</Text>
          {!d.taxConfirmed && <Text>[Tax rate, SAC and place of supply pending confirmation by the organiser's accountant.]</Text>}
        </View>
      </Page>
    </Document>,
  );
}
