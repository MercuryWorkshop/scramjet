/* eslint-disable no-async-promise-executor */
import { expect, FrameLocator, Page } from "@playwright/test";

export function setupPage(page: Page, url: string): Promise<FrameLocator> {
    return new Promise(async (resolve) => {
        await page.waitForSelector(".version > b");
        const bar = page.locator(".bar");
        const title = await page.locator(".version > b").textContent();
        const frame = page.frameLocator("iframe");
        expect(title).toBe("scramjet");

        expect(bar).not.toBeNull();

        await bar.fill(url);

        await page.waitForTimeout(1000);
        
        await bar.press("Enter");
        resolve(frame);
    });
}