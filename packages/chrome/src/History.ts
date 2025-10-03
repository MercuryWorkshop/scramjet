import { createState } from "dreamland/core";
import { browser } from "./Browser";
import { StatefulClass } from "./StatefulClass";
import type { Tab } from "./Tab";
import { sendFrame } from "./IsolatedFrame";

// history api emulation
export class HistoryState extends StatefulClass {
	url: URL = null!;
	state: any;
	title: string | null = null;
	favicon: string | null = null;
	timestamp: number;

	virtual: boolean = false; // whether this state was created by pushState and can be navigated to without a full reload

	constructor(partial?: Partial<HistoryState>) {
		super(createState(Object.create(HistoryState.prototype)));
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
	justTriggeredNavigation: boolean = false;

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
		if (this.index + 1 < this.states.length)
			// "fork" history tree, creating a new timeline
			this.states.splice(this.index, this.states.length - this.index);
		const hstate = new HistoryState({ url, state });
		if (url.href != "puter://newtab") browser.globalhistory.push(hstate);
		this.states.push(hstate);
		this.index++;

		if (navigate) {
			this.justTriggeredNavigation = true;
			this.tab._directnavigate(url);
		} else this.tab.url = url;

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

		if (navigate) {
			this.justTriggeredNavigation = true;
			this.tab._directnavigate(url);
		}

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

		let newstate = this.states[this.index];

		if (newstate.virtual) {
			sendFrame(this.tab, "history_go", {
				delta,
			});
		} else if (navigate) {
			this.justTriggeredNavigation = true;
			this.tab._directnavigate(newstate.url);
		}

		if (newstate.virtual || !navigate) {
			this.tab.url = newstate.url;
			this.tab.title = newstate.title;
			this.tab.icon = newstate.favicon;
		}

		this.tab.canGoBack = this.canGoBack();
		this.tab.canGoForward = this.canGoForward();

		return newstate;
	}
	canGoBack(): boolean {
		return this.index > 0;
	}
	canGoForward(): boolean {
		return this.index < this.states.length - 1;
	}
}
