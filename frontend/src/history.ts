import type { Tab } from "./Tab";

// history api emulation
export type HistoryState = {
	state: any;
	url: string;
};

export function injectHistoryEmulation(client: ScramjetClient, tab: Tab) {
	client.Proxy("History.prototype.pushState", {
		apply(ctx) {
			console.log("STATE PUSH", ctx.args);
			ctx.return(undefined);
		},
	});

	client.Proxy("History.prototype.replaceState", {
		apply(ctx) {
			console.log("STATE REPLACE", ctx.args);
			ctx.return(undefined);
		},
	});
}

export function handleNavigate() {}
