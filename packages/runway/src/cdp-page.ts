import type { Page } from "playwright";
import { CDP_INIT_SCRIPT } from "./cdp-init.ts";

export type RunwayBindingCalledEvent = {
	name: string;
	payload: string;
};

export type RunwayPageBindingsHandle = {
	dispose: () => void;
};

const RUNWAY_BINDINGS = [
	"__testPass",
	"__testFail",
	"__testConsistent",
	"__testOk",
] as const;

export async function setupRunwayPageBindings(
	page: Page,
	onBindingCalled: (event: RunwayBindingCalledEvent) => void
): Promise<RunwayPageBindingsHandle> {
	const context = page.context();

	await context.addInitScript(CDP_INIT_SCRIPT);
	await context.exposeBinding("__runwayControl", async (source, payload) => {
		const request =
			typeof payload === "string" ? JSON.parse(payload) : (payload ?? {});
		switch (request?.action) {
			case "clearCookies":
				await context.clearCookies();
				await page.evaluate(() => {
					const clientKey = Symbol.for("scramjet client global");
					const visited = new Set<Window>();
					const clearWindow = (win: Window) => {
						if (visited.has(win)) return;
						visited.add(win);
						(win as any)[clientKey]?.context?.cookieJar?.clear?.();
						for (let i = 0; i < win.frames.length; i++) {
							try {
								clearWindow(win.frames[i]);
							} catch {}
						}
					};

					(window as any).__runwayController?.cookieJar?.clear?.();
					(window as any).__runwayScramjetFrame?.context?.cookieJar?.clear?.();
					clearWindow(window);
				});
				return { ok: true };
			default:
				throw new Error(`Unknown runway control action: ${request?.action}`);
		}
	});

	for (const name of RUNWAY_BINDINGS) {
		await context.exposeBinding(name, (_source, payload) => {
			onBindingCalled({ name, payload: String(payload ?? "") });
		});
	}

	return {
		dispose: () => {},
	};
}
