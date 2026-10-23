import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "./viewports";

/**
 * Change request §5 acceptance, at every test viewport:
 * (a) height ≥ 600: the hero's bottom edge equals the viewport height (±1px)
 * (b) "Book your pass" fully visible, its bottom ≥ 12px above the viewport bottom
 * (c) the marquee text is not clipped
 * (d) no sideways scrolling: scrollWidth === viewport width
 */
for (const vp of VIEWPORTS) {
  test(`hero fits ${vp.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: vp.mobile ? 2 : 1,
    });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500); // entrance animation (150ms delay + 0.9s) settles

    const m = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("section.hero")!;
      const cta = document.getElementById("hero-cta")!;
      const marquee = document.querySelector<HTMLElement>("[data-testid=hero-marquee]")!;
      const line = marquee.firstElementChild as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      const clipsY = (el: HTMLElement | null): string | null => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const oy = getComputedStyle(e).overflowY;
          if (oy !== "visible") return `${e.className || e.tagName}:${oy}`;
        }
        return null;
      };
      const r = (el: Element) => el.getBoundingClientRect();
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        hero: r(hero).toJSON(),
        cta: r(cta).toJSON(),
        marquee: r(marquee).toJSON(),
        text: { top: text.top, bottom: text.bottom, height: text.height },
        fontSize: parseFloat(getComputedStyle(line).fontSize),
        clippingAncestor: clipsY(marquee),
      };
    });

    await page.screenshot({ path: `test-results/hero/${vp.name}.png` });

    // (a)
    if (vp.height >= 600) expect(Math.abs(m.hero.bottom - m.vh), `hero bottom ${m.hero.bottom} vs ${m.vh}`).toBeLessThanOrEqual(1);
    // (b)
    expect(m.cta.top, "CTA top on screen").toBeGreaterThanOrEqual(0);
    expect(m.cta.left).toBeGreaterThanOrEqual(0);
    expect(m.cta.right).toBeLessThanOrEqual(m.vw);
    expect(m.cta.bottom, `CTA bottom ${m.cta.bottom} vs viewport ${m.vh}`).toBeLessThanOrEqual(m.vh - 12);
    // (c) nothing clips the marquee vertically, and the glyph box is a full line of type
    expect(m.clippingAncestor, "an ancestor clips the marquee vertically").toBeNull();
    expect(m.text.height).toBeGreaterThanOrEqual(m.fontSize * 0.85);
    expect(m.text.bottom).toBeLessThanOrEqual(m.hero.bottom + 0.5);
    // (d)
    expect(m.scrollWidth, "no sideways scrolling").toBe(m.vw);

    await context.close();
  });
}
