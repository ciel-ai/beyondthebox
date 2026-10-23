import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { qrToken } from "../crypto";
import { registerPdfFonts } from "./fonts";

export type TicketPdfData = {
  ticketId: string;
  serial: string;
  attendeeName: string;
  tierName: string;
  reference: string;
  eventName: string;
  subtitle: string;
  dateLabel: string;
  venueLabel: string;
  isTest: boolean;
};

const GOLD = "#DDBB4B";

const s = StyleSheet.create({
  page: { backgroundColor: "#000000", color: "#FFFFFF", fontFamily: "Manrope", padding: 36 },
  top: { flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: "#A6A6A6", letterSpacing: 1 },
  title: { fontFamily: "Anton", fontSize: 44, lineHeight: 1.15, marginTop: 20, textTransform: "uppercase" },
  the: { color: GOLD },
  subtitle: { fontSize: 11, color: "#A6A6A6", marginTop: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#333333", marginVertical: 20 },
  body: { flexDirection: "row", gap: 24 },
  fields: { flex: 1, gap: 14 },
  label: { fontSize: 8, color: "#A6A6A6", letterSpacing: 1, textTransform: "uppercase" },
  value: { fontSize: 13, fontWeight: 600, marginTop: 3 },
  tier: { fontFamily: "Anton", fontSize: 26, color: GOLD, textTransform: "uppercase", marginTop: 2 },
  qrBox: { width: 190, alignItems: "center" },
  qr: { width: 190, height: 190 },
  qrNote: { fontSize: 8, color: "#A6A6A6", marginTop: 8, textAlign: "center" },
  foot: { position: "absolute", left: 36, right: 36, bottom: 28, fontSize: 8, color: "#A6A6A6", flexDirection: "row", justifyContent: "space-between" },
  test: { position: "absolute", top: 14, right: 36, fontSize: 9, fontWeight: 700, color: "#000000", backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 3 },
});

function TicketPage({ t, qr }: { t: TicketPdfData; qr: string }) {
  return (
    <Page size="A5" orientation="landscape" style={s.page}>
      {t.isTest && <Text style={s.test}>TEST TICKET: NOT VALID FOR ENTRY</Text>}
      <View style={s.top}>
        <Text>ADMIT ONE</Text>
        <Text>{t.serial}</Text>
      </View>
      <Text style={s.title}>
        Beyond <Text style={s.the}>the</Text> Limits
      </Text>
      <Text style={s.subtitle}>{t.subtitle}</Text>
      <View style={s.rule} />
      <View style={s.body}>
        <View style={s.fields}>
          <View>
            <Text style={s.label}>Pass</Text>
            <Text style={s.tier}>{t.tierName}</Text>
          </View>
          <View>
            <Text style={s.label}>Attendee</Text>
            <Text style={s.value}>{t.attendeeName}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 24 }}>
            <View>
              <Text style={s.label}>Date</Text>
              <Text style={s.value}>{t.dateLabel}</Text>
            </View>
            <View>
              <Text style={s.label}>Venue</Text>
              <Text style={s.value}>{t.venueLabel}</Text>
            </View>
          </View>
          <View>
            <Text style={s.label}>Booking reference</Text>
            <Text style={s.value}>{t.reference}</Text>
          </View>
        </View>
        <View style={s.qrBox}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.qr} src={qr} />
          <Text style={s.qrNote}>Show this code at the entrance. One scan per ticket.</Text>
        </View>
      </View>
      <View style={s.foot}>
        <Text>{t.eventName}</Text>
        <Text>Ticket ID {t.ticketId}</Text>
      </View>
    </Page>
  );
}

export async function renderTicketPdf(tickets: TicketPdfData[]) {
  registerPdfFonts();
  const pages = await Promise.all(
    tickets.map(async (t) => ({
      t,
      // The QR carries only the signed token: ticket ID + HMAC, no personal data.
      qr: await QRCode.toDataURL(qrToken(t.ticketId), { errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#000000", light: "#FFFFFF" } }),
    })),
  );
  return renderToBuffer(
    <Document title="Beyond the Limits e-ticket" author="Beyond the Limits">
      {pages.map(({ t, qr }) => (
        <TicketPage key={t.ticketId} t={t} qr={qr} />
      ))}
    </Document>,
  );
}
