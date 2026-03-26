import type { CDPSession, Page } from "playwright";
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
	const sessions = new Map<Page, CDPSession>();
	let disposed = false;

	const attachBindings = async (targetPage: Page) => {
		if (disposed || sessions.has(targetPage) || targetPage.isClosed()) return;
		const cdp = await context.newCDPSession(targetPage);
		sessions.set(targetPage, cdp);
		await cdp.send("Page.enable");
		await cdp.send("Runtime.enable");
		await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
			source: CDP_INIT_SCRIPT,
		});
		for (const name of RUNWAY_BINDINGS) {
			await cdp.send("Runtime.addBinding", { name });
		}
		cdp.on("Runtime.bindingCalled", onBindingCalled);
		try {
			await cdp.send("Runtime.evaluate", { expression: CDP_INIT_SCRIPT });
		} catch {
			// Target may close before evaluation.
		}
		targetPage.on("close", () => {
			const targetCdp = sessions.get(targetPage);
			if (!targetCdp) return;
			sessions.delete(targetPage);
			void targetCdp.detach().catch(() => {});
		});
	};

	const onContextPage = (candidate: Page) => {
		void (async () => {
			if (disposed || candidate === page) return;
			await attachBindings(candidate);
		})();
	};

	const onRootPopup = (popup: Page) => {
		void attachBindings(popup);
	};

	context.on("page", onContextPage);
	page.on("popup", onRootPopup);
	await attachBindings(page);

	return {
		dispose: () => {
			if (disposed) return;
			disposed = true;
			context.off("page", onContextPage);
			page.off("popup", onRootPopup);
			for (const cdp of sessions.values()) {
				void cdp.detach().catch(() => {});
			}
			sessions.clear();
		},
	};
}
