import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import type { LegalKind } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Minimal Markdown (## headings, - lists, **bold**) for organiser-controlled legal text. Output is escaped. */
function render(md: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>");
  const out: string[] = [];
  let list = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("- ")) {
      if (!list) out.push("<ul>");
      list = true;
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (list) {
      out.push("</ul>");
      list = false;
    }
    if (line.startsWith("## ")) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("\n");
}

export async function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = await db.legalDocument.findFirst({ where: { kind }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-32 pt-36">
        <h1 className="display display-l">{doc?.title ?? "Policy"}</h1>
        <p className="meta mt-4 text-muted">
          Version {doc?.version ?? "–"} · {doc?.approvedAt ? "Approved" : "[Pending organiser approval]"}
        </p>
        <article className="prose-legal mt-10" dangerouslySetInnerHTML={{ __html: doc ? render(doc.body) : "<p>[Pending organiser approval]</p>" }} />
      </main>
      <Footer />
    </>
  );
}
