import { expect, test } from "@playwright/test";

/** A field focused by "jump to the first error" must not land under the fixed header. */
for (const vp of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`first invalid field is visible below the header at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/checkout/details?tier=STANDARD&qty=2");
    await page.getByRole("button", { name: /continue to review/i }).click();
    const field = page.locator("[name='buyer.name']");
    await expect(field).toBeFocused();
    await page.waitForTimeout(800); // let any smooth scroll finish
    const header = await page.locator("header").boundingBox();
    const box = await field.boundingBox();
    expect(box!.y, "focused field sits below the fixed header").toBeGreaterThanOrEqual(header!.y + header!.height);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  });
}
