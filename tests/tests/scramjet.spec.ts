import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:1337");
});

test.describe("Page loaded", () => {
    test("should display the title", async ({ page }) => {
        const title = await page.locator("h1").textContent();
        expect(title).toBe("Percury Unblocker");
    });
})