import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <LegalPage kind="PRIVACY" />;
}
