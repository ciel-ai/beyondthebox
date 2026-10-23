"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  type = "text",
  autoComplete,
  inputMode,
  value,
  onChange,
  required = true,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <label htmlFor={id} className="meta block text-white">
        {label}
        {!required && <span className="text-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className="field mt-2"
      />
      {error && <FieldError id={errId!}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-[14px] text-gold-deep">
      <svg viewBox="0 0 16 16" width={16} height={16} className="mt-[3px] shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4.2M8 11v.5" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/** Cloudflare Turnstile. Calls onToken with a fresh token; resets when `resetKey` changes. */
export function Turnstile({ onToken, resetKey, error }: { onToken: (t: string) => void; resetKey: number; error?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

  const render = () => {
    if (!box.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: (t: string) => onToken(t),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  };

  useEffect(() => {
    render();
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetKey && widget.current) {
      onToken("");
      window.turnstile?.reset(widget.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} />
      <div ref={box} className="min-h-[65px]" />
      {error && <FieldError id="turnstile-err">{error}</FieldError>}
    </div>
  );
}

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Details", "Review", "Pay"];
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Checkout progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className={`ui flex items-center gap-2 ${state === "todo" ? "text-muted" : "text-white"}`}>
            <span
              className={`tnum flex h-7 w-7 items-center justify-center rounded-full border text-[12px] ${
                state === "current" ? "border-gold-deep text-gold-deep" : state === "done" ? "border-white" : "border-edge"
              }`}
            >
              {n}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}
