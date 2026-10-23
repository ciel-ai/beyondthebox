import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refund and Cancellation Policy", alternates: { canonical: "/refund-policy" } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <LegalPage kind="REFUND" />;
}
