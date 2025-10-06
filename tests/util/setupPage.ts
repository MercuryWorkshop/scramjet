/* eslint-disable no-async-promise-executor */
import { expect, FrameLocator, Page } from "@playwright/test";
import { registerInspect } from "./inspectConsole";

export async function setupPage(
	page: Page,
	url: string
): Promise<FrameLocator> {
	// Hack to disable HTTP cache.
	await page.route("**", (route) => route.continue());
	// Goto base url defined in config.
	await page.goto("/");
	await page.waitForSelector(".version > b");
	const bar = page.locator(".bar");
	const title = await page.locator(".version > b").textContent();
	const frame = page.frameLocator("iframe");
	expect(title).toBe("scramjet");

	expect(bar).not.toBeNull();

	await bar.fill(url);

	await page.waitForTimeout(1000);

	await bar.press("Enter");

	registerInspect(page);

	return frame;
}
