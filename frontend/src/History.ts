import { browser } from "./main";
import type { Tab } from "./Tab";

// history api emulation
export class HistoryState {
	url: URL;
	state: any;
	title: string | null;
	favicon: string | null;
	timestamp: number;

	constructor(partial?: Partial<HistoryState>) {
		Object.assign(this, partial);
		this.timestamp = Date.now();
	}

	serialize(): SerializedHistoryState {
		return {
			state: this.state,
			url: this.url.href,
			title: this.title,
			favicon: this.favicon,
			timestamp: this.timestamp,
		};
	}
	deserialize(de: SerializedHistoryState) {
		this.state = de.state;
		this.url = new URL(de.url);
		this.title = de.title;
		this.favicon = de.favicon;
		this.timestamp = de.timestamp;
	}
}
export type SerializedHistoryState = {
	state: any;
	url: string;
	title: string | null;
	favicon: string | null;
	timestamp: number;
};

export type SerializedHistory = {
	index: number;
	states: SerializedHistoryState[];
};

export class History {
	index: number = -1;
	states: HistoryState[] = [];

	constructor(private tab: Tab) {}

	serialize(): SerializedHistory {
		return {
			index: this.index,
			states: this.states.map((s) => s.serialize()),
		};
	}
	deserialize(de: SerializedHistory) {
		this.index = de.index;
		this.states = de.states.map((s) => {
			const state = new HistoryState();
			state.deserialize(s);

			return state;
		});
	}
	current(): HistoryState {
		if (this.index < 0 || this.index >= this.states.length) {
			throw new Error("No current history state");
		}

		return this.states[this.index];
	}

	push(url: URL, state: any = null, navigate: boolean = true): HistoryState {
		const hstate = new HistoryState({ url, state });
		if (url.href != "puter://newtab") browser.globalhistory.push(hstate);
		this.states.push(hstate);
		this.index++;

		if (navigate) this.tab._directnavigate(url);

		this.tab.canGoBack = this.canGoBack();
		this.tab.canGoForward = this.canGoForward();

		return this.states[this.index];
	}
	replace(url: URL, state: any, navigate: boolean = true): HistoryState {
		if (this.index < this.states.length) {
			this.current().url = url;
			this.current().state = state;
			this.current().title = null;
			this.current().favicon = null;
		} else {
			return this.push(url, state);
		}

		if (navigate) this.tab._directnavigate(url);

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

		if (navigate) this.tab._directnavigate(this.states[this.index].url);

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

export function addHistoryListeners(frame: ScramjetFrame, tab: Tab) {
	frame.addEventListener("navigate", (e) => {
		console.log("History push from navigate", e, tab.history.states);
		// this event is fired whenever location.href is set, or similar
		// importantly not fired when replaceState is called (we overwrite it ourselves in injectContext)

		// behavior here is just to create a new history entry
		const url = new URL(e.url);
		tab.history.push(url, undefined, false);

		console.log("History push from navigate", url, tab.history.states);
	});
}

export function injectHistoryEmulation(client: ScramjetClient, tab: Tab) {
	// this is extremely problematic in terms of security but whatever
	client.global.addEventListener("beforeunload", (e: BeforeUnloadEvent) => {
		console.log("History beforeunload", e);
	});

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
	client.Proxy("History.prototype.back", {
		apply(ctx) {
			console.log("HISTORY BACK", ctx);
			tab.history.go(-1);
			ctx.return(undefined);
		},
	});
	client.Proxy("History.prototype.forward", {
		apply(ctx) {
			console.log("HISTORY FORWARD", ctx);
			tab.history.go(1);
			ctx.return(undefined);
		},
	});
	client.Proxy("History.prototype.go", {
		apply(ctx) {
			console.log("HISTORY GO", ctx);
			tab.history.go(ctx.args[0]);
			ctx.return(undefined);
		},
	});
}

export function handleNavigate() {}
