import type { Tab } from "./Tab";

// history api emulation
export type HistoryState = {
	state: any;
	url: URL;
};

export class History {
	index: number = -1;
	states: HistoryState[] = [];

	constructor(private tab: Tab) {}

	push(url: URL, state: any, navigate: boolean = true): HistoryState {
		this.states.push({ url, state });
		this.index++;

		if (navigate) this.tab.navigate(url);

		this.tab.canGoBack = this.canGoBack();
		this.tab.canGoForward = this.canGoForward();

		return this.states[this.index];
	}
	replace(url: URL, state: any, navigate: boolean = true): HistoryState {
		if (this.index < this.states.length) {
			this.states[this.index] = { url, state };
		} else {
			this.push(url, state);
		}

		if (navigate) this.tab.navigate(url);

		this.tab.canGoBack = this.canGoBack();
		this.tab.canGoForward = this.canGoForward();

		return this.states[this.index];
	}
	go(delta: number, navigate: boolean = true): HistoryState {
		this.index += delta;
		if (this.index < 0) {
			this.index = 0;
		} else if (this.index >= this.states.length) {
			this.index = this.states.length - 1;
		}

		if (navigate) this.tab.navigate(this.states[this.index].url);

		this.tab.canGoBack = this.canGoBack();
		this.tab.canGoForward = this.canGoForward();

		return this.states[this.index];
	}
	canGoBack(): boolean {
		return this.index > 0;
	}
	canGoForward(): boolean {
		return this.index < this.states.length - 1;
	}
}

export function injectHistoryEmulation(frame: ScramjetFrame, tab: Tab) {
	frame.addEventListener("navigate", (e) => {
		// this event is fired whenever location.href is set, or similar
		// importantly not fired when replaceState is called (we overwrite it ourselves in injectContext)

		// behavior here is just to create a new history entry
		const url = new URL(e.url);
		tab.history.push(url, undefined, false);

		console.log("History push from navigate", url, tab.history.states);
	});
	frame.frame.addEventListener("beforeunload", (e: BeforeUnloadEvent) => {
		console.log("History beforeunload", e);
	});
}

function injectContext(client: ScramjetClient, tab: Tab) {
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
