import Image from "next/image";
import Link from "next/link";
import { InstagramIcon, LinkedInIcon, SocialButton, XIcon } from "./brand";

export type SpeakerCardData =
  | { tba: false; slug: string; name: string; role: string; photoUrl: string | null; xUrl: string | null; linkedinUrl: string | null; instagramUrl: string | null }
  | { tba: true; name: string };

function Silhouette() {
  return (
    <svg viewBox="0 0 430 615" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <rect width="430" height="615" fill="#121212" />
      <circle cx="215" cy="250" r="78" fill="#1c1c1c" />
      <path d="M60 615c8-150 70-232 155-232s147 82 155 232Z" fill="#1c1c1c" />
    </svg>
  );
}

export function SpeakerCard({ s, sizes = "(min-width: 1024px) 430px, 78vw" }: { s: SpeakerCardData; sizes?: string }) {
  const face = (
    <div className="relative aspect-[430/615] w-full overflow-hidden rounded-sm bg-surface">
      {!s.tba && s.photoUrl ? (
        <Image src={s.photoUrl} alt={`Portrait of ${s.name}`} fill sizes={sizes} className="object-cover" draggable={false} />
      ) : (
        <>
          <Silhouette />
          {!s.tba && <span className="absolute left-4 top-4 text-[12px] font-medium text-muted">[Speaker photo]</span>}
        </>
      )}
      {/* Black scrim fading up from the bottom 40% so the name stays legible on any photo. */}
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black via-black/70 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-7 text-center">
        <p className="display text-[32px] text-white lg:text-[40px]">{s.name}</p>{" "}
        <p className="mt-2 text-[15px] font-medium text-muted">{s.tba ? "Revealing soon" : s.role}</p>
      </div>
    </div>
  );

  return (
    <article className="flex flex-col items-center gap-5">
      {s.tba ? (
        face
      ) : (
        <Link href={`/speakers/${s.slug}`} className="block w-full rounded-sm" draggable={false}>
          {face}
        </Link>
      )}
      {s.tba ? (
        <div className="h-14" aria-hidden />
      ) : (
        <ul className="flex gap-3" aria-label={`${s.name} on social media`}>
          <li>
            <SocialButton s={{ label: "X", href: s.xUrl, Icon: XIcon }} context={s.name} />
          </li>
          <li>
            <SocialButton s={{ label: "LinkedIn", href: s.linkedinUrl, Icon: LinkedInIcon }} context={s.name} />
          </li>
          <li>
            <SocialButton s={{ label: "Instagram", href: s.instagramUrl, Icon: InstagramIcon }} context={s.name} />
          </li>
        </ul>
      )}
    </article>
  );
}
