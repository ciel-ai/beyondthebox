"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "./brand";

/** Large contact value with a copy button. Without a value it shows the placeholder and disables copy. */
export function CopyField({ label, value, href, placeholder }: { label: string; value: string | null; href: string | null; placeholder: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border-b border-hairline py-6">
      <div className="flex items-center justify-between gap-4">
        <p className="meta text-muted">{label}</p>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          className="btn btn-dark btn-sm !min-h-11 !px-4"
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <p className="mt-2 break-words text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold leading-tight">
        {value && href ? (
          <a href={href} className="hover:text-gold-deep">
            {value}
          </a>
        ) : (
          <span className="text-muted">{placeholder}</span>
        )}
      </p>
      <span className="sr-only" aria-live="polite">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </div>
  );
}
