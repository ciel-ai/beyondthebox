import { expect, test } from "@playwright/test";

/** Below 768px: the bar appears once the hero CTA scrolls away and hides over the tickets section. */
test("sticky booking bar on phones", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const bar = page.locator("div.fixed.bottom-0").filter({ hasText: "Book your pass" });
  await expect(bar).toHaveAttribute("aria-hidden", "true"); // hero CTA visible
  await page.evaluate(() => document.getElementById("about")!.scrollIntoView({ behavior: "instant" }));
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await page.screenshot({ path: "test-results/hero/phone-390x844-sticky-bar.png" });
  await page.evaluate(() => document.getElementById("tickets")!.scrollIntoView({ behavior: "instant" }));
  await expect(bar).toHaveAttribute("aria-hidden", "true"); // never covers the ticket stubs
  await ctx.close();
});

test("no sticky bar from 768px up", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.evaluate(() => document.getElementById("about")!.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator("div.fixed.bottom-0").filter({ hasText: "Book your pass" })).toBeHidden();
});
