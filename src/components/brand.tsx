import type { SVGProps } from "react";

/** Two-line stacked wordmark: BEYOND / THE LIMITS, with THE in gold-deep. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display block text-[20px] leading-[0.92] tracking-[0.02em] ${className}`}>
      <span className="block">Beyond</span>{" "}
      <span className="block">
        <span className="text-gold-deep">The</span> Limits
      </span>
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const XIcon = (p: IconProps) => (
  <svg {...base} fill="currentColor" {...p}>
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
  </svg>
);
export const LinkedInIcon = (p: IconProps) => (
  <svg {...base} fill="currentColor" {...p}>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
  </svg>
);
export const InstagramIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
export const YouTubeIcon = (p: IconProps) => (
  <svg {...base} fill="currentColor" {...p}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.1V8.9L15.2 12 10 15.1Z" />
  </svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base} width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export type Social = { label: string; href: string | null; Icon: (p: IconProps) => React.ReactElement };

/** Circular 56px social button. Without a URL it renders as a dimmed, labelled placeholder. */
export function SocialButton({ s, context }: { s: Social; context?: string }) {
  const label = context ? `${context} on ${s.label}` : s.label;
  const cls = "flex h-14 w-14 items-center justify-center rounded-full border text-white transition-colors";
  if (!s.href) {
    return (
      <span role="img" aria-label={`${label}: link to be added`} className={`${cls} border-hairline opacity-40`}>
        <s.Icon />
      </span>
    );
  }
  return (
    <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`${cls} border-edge hover:border-gold-deep`}>
      <s.Icon />
    </a>
  );
}
