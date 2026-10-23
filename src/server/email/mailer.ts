import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { env } from "../env";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Stable key so a retried job never sends the same email twice through Resend. */
  idempotencyKey: string;
  tag: string;
};

/** Test runs capture mail in memory. */
export const sentMail: Mail[] = [];

let resend: Resend | null = null;

export async function deliver(mail: Mail) {
  const e = env();
  if (e.NODE_ENV === "test") {
    sentMail.push(mail);
    return;
  }
  if (!e.RESEND_API_KEY) {
    // Local development without Resend: write to .dev-mail (git-ignored). Never logged.
    const dir = path.join(process.cwd(), ".dev-mail");
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(dir, `${stamp}-${mail.tag}.html`), `<!-- To: ${mail.to} | ${mail.subject} -->\n${mail.html}`);
    for (const a of mail.attachments ?? []) await writeFile(path.join(dir, `${stamp}-${a.filename}`), a.content);
    return;
  }
  resend ??= new Resend(e.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: e.EMAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
      tags: [{ name: "type", value: mail.tag }],
    },
    { idempotencyKey: mail.idempotencyKey },
  );
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
}
