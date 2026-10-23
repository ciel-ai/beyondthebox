import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms and Conditions", alternates: { canonical: "/terms" } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <LegalPage kind="TERMS" />;
}
