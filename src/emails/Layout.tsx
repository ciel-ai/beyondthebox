import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const font = "Manrope, Helvetica, Arial, sans-serif";

/** Black header with the gold wordmark; light body so every client renders it legibly. */
export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#F4F4F4", margin: 0, fontFamily: font }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#FFFFFF" }}>
          <Section style={{ backgroundColor: "#000000", padding: "28px 32px" }}>
            <Text style={{ margin: 0, color: "#FFFFFF", fontSize: 22, lineHeight: "24px", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>
              Beyond <span style={{ color: "#DDBB4B" }}>the</span> Limits
            </Text>
            <Text style={{ margin: "6px 0 0", color: "#A6A6A6", fontSize: 13 }}>A Business Conclave 2026</Text>
          </Section>
          <Section style={{ padding: "32px", color: "#111111", fontSize: 15, lineHeight: "24px" }}>{children}</Section>
          <Hr style={{ borderColor: "#E5E5E5", margin: 0 }} />
          <Section style={{ padding: "20px 32px", color: "#666666", fontSize: 12, lineHeight: "18px" }}>
            <Text style={{ margin: 0 }}>You're receiving this because you booked or asked about Beyond the Limits. Questions? Reply to this email.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 22, lineHeight: "28px", fontWeight: 800, margin: "0 0 12px", color: "#000000" }}>{children}</Text>;
}

export function P({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 14px" }}>{children}</Text>;
}

/** Black button with white text (no gold on light backgrounds). */
export function Cta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{ backgroundColor: "#000000", color: "#FFFFFF", padding: "14px 22px", borderRadius: 8, fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: "uppercase" }}
    >
      {children}
    </Button>
  );
}

export function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderTop: "1px solid #E5E5E5", margin: "8px 0 20px" }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ padding: "10px 0", borderBottom: "1px solid #E5E5E5", color: "#666666", fontSize: 13 }}>{k}</td>
            <td style={{ padding: "10px 0", borderBottom: "1px solid #E5E5E5", textAlign: "right", fontWeight: 600 }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
