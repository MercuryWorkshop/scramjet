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

	for (const name of RUNWAY_BINDINGS) {
		await context.exposeBinding(name, (_source, payload) => {
			onBindingCalled({ name, payload: String(payload ?? "") });
		});
	}

	return {
		dispose: () => {},
	};
}
