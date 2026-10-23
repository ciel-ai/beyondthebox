"use client";

import { useEffect } from "react";

/** Counts one visit per browser session for the conversion chart. No cookies, no identifiers. */
export function VisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("btl-v")) return;
      sessionStorage.setItem("btl-v", "1");
    } catch {
      return;
    }
    navigator.sendBeacon?.("/api/funnel");
  }, []);
  return null;
}
