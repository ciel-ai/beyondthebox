"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS, ROUTE_TO_NAV } from "./nav";

/**
 * Scroll-spy for the navigation.
 * Home: the section crossing the middle band of the viewport → "/#id"; undefined in the hero.
 * Other routes: pathname → nav item (e.g. /speakers → "/#speakers"), else undefined.
 */
export function useActiveSection(): string | undefined {
  const pathname = usePathname();
  const [active, setActive] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (pathname !== "/") {
      const match = Object.entries(ROUTE_TO_NAV).find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
      setActive(match?.[1]);
      return;
    }
    const ids = NAV_LINKS.map((l) => l.href.replace("/#", ""));
    const targets = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // The last section in document order that crosses the band wins; none → hero → undefined.
        const current = ids.filter((id) => visible.has(id)).pop();
        setActive(current ? `/#${current}` : undefined);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [pathname]);

  return active;
}
