import { test, expect } from "@playwright/test";
import { setupPage } from "./setupPage";

test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:1337/");
});

test.describe("YouTube", () => {
    test("The front page can load.", async ({ page }) => {
        const frame = await setupPage(page, "https://www.youtube.com/");

        // Wait for the page inside the iframe to load

        const logo = await frame.locator("#logo-icon > span > div").first().waitFor({ state: "visible" });
        expect(logo).not.toBeNull();
    });

    test("The search page can load.", async ({ page }) => {
        const frame = await setupPage(page, "https://www.youtube.com/results?search_query=bad+apple");

        const title = await frame.locator("#video-title > yt-formatted-string").first().textContent({ timeout: 5000 });
        const thumbnailSelector = "#contents > ytd-video-renderer:nth-child(1) > #dismissible > ytd-thumbnail > a > yt-image > img";
        await frame.locator(thumbnailSelector).waitFor({ state: "visible" });

        const thumbnailSrc = await frame.locator(thumbnailSelector).getAttribute("src", { timeout: 5000 });
        
        expect(title).not.toBeNull();
        expect(thumbnailSrc).not.toBeNull();
    });
})