import { createState, type Delegate, type Stateful } from "dreamland/core";
import { StatefulClass } from "./StatefulClass";
import { Tab, type SerializedTab } from "./Tab";
import { createDelegate } from "dreamland/core";
import type { SerializedHistoryState } from "./History";
import { HistoryState } from "./History";
import { focusOmnibox } from "./components/UrlInput";

import * as tldts from "tldts";
import { isPuter, scramjet } from "./main";
import { animateDownloadFly, showDownloadsPopup } from "./components/Omnibox";
export const pushTab = createDelegate<Tab>();
export const popTab = createDelegate<Tab>();
export const forceScreenshot = createDelegate<Tab>();
import type { ScramjetDownload } from "@mercuryworkshop/scramjet";
// import { deserializeAll, serializeAll } from "./serialize";

export let browser: Browser;

export const config = createState({
	theme: {
		frame_bg: [231, 238, 245],
		toolbar_bg: [211, 218, 255],
		toolbar_button_fg: [65, 72, 76],
		toolbar_fg: [65, 72, 76],

		inactive_tab_bg: [40, 40, 40],
		inactive_tab_fg: [95, 92, 96],
		active_tab_fg: [65, 72, 76],

		button_bg: [231, 238, 0],

		ntp_bg: [231, 238, 0],
		ntp_fg: [232, 234, 237],
		ntp_link_fg: [138, 180, 248],

		omnibox_bg: [221, 228, 235],
		omnibox_fg: [227, 227, 227],

		bookmark_fg: [199, 199, 199],
	},
});

export type SerializedBrowser = {
	tabs: SerializedTab[];
	globalhistory: SerializedHistoryState[];
	globalDownloadHistory: DownloadEntry[];
	activetab: number;
	bookmarks: BookmarkEntry[];
	settings: Settings;
};

export type GlobalHistoryEntry = {
	timestamp: number;
	url: string;
	title: string;
	favicon?: string;
};

export type BookmarkEntry = {
	url: string;
	title: string;
	favicon?: string;
};

export type DownloadEntry = {
	url: string;
	filename: string;
	timestamp: number;
	size: number;
	id: string;
	cancelled: boolean;

	progress?: number;
	progressbytes?: number;
	paused?: boolean;
	cancel?: Delegate<void>;
	pause?: Delegate<void>;
};

export type Settings = {
	theme: "dark" | "light";
	bookmarksPinned: boolean;
};

export class Browser extends StatefulClass {
	built: boolean = false;

	tabs: Tab[] = [];
	activetab: Tab = null!;

	globalhistory: HistoryState[] = [];
	bookmarks: Stateful<BookmarkEntry>[] = [];

	sessionDownloadHistory: Stateful<DownloadEntry>[] = [];
	globalDownloadHistory: Stateful<DownloadEntry>[] = [];

	unfocusframes: boolean = false;

	downloadProgress = 0;

	settings: Stateful<Settings> = createState({
		theme: "light",
		bookmarksPinned: false,
	});

	constructor() {
		super(createState(Object.create(Browser.prototype)));

		setInterval(saveBrowserState, 10000);

		scramjet.addEventListener("download", (e) => {
			this.startDownload(e.download);
		});
	}

	async startDownload(download: ScramjetDownload) {
		this.downloadProgress = 0.1;
		let downloaded = 0;
		animateDownloadFly();

		let filename = download.filename;
		if (!filename) {
			let url = new URL(download.url);
			filename =
				decodeURIComponent(url.pathname.split("/").at(-1) || "") ||
				url.hostname.replaceAll(".", "-");
		}

		let cancel = createDelegate<void>();
		let pause = createDelegate<void>();

		let entry: Stateful<DownloadEntry> = createState({
			filename,
			url: download.url,
			size: download.length,
			timestamp: Date.now(),
			id: crypto.randomUUID(),
			cancelled: false,

			progress: 0,
			progressbytes: 0,
			paused: false,
			cancel,
			pause,
		});
		this.globalDownloadHistory = [entry, ...this.globalDownloadHistory];
		this.sessionDownloadHistory = [entry, ...this.sessionDownloadHistory];

		let resumeResolver: (() => void) | null = null;
		const ac = new AbortController();

		pause.listen(() => {
			entry.paused = !entry.paused;
			if (!entry.paused) {
				resumeResolver?.();
				resumeResolver = null;
			}
		});

		cancel.listen(() => {
			entry.cancelled = true;
			ac.abort();
		});

		const pausableProgress = new TransformStream<Uint8Array, Uint8Array>({
			async transform(chunk, controller) {
				if (entry.paused)
					await new Promise<void>((res) => (resumeResolver = res));
				downloaded += chunk.byteLength;
				entry.progressbytes = downloaded;
				browser.downloadProgress = entry.progress = Math.min(
					(download.length ? downloaded / download.length : 0) + 0.1,
					1
				);
				controller.enqueue(chunk);
			},
		});

		const streamnull = new WritableStream<Uint8Array>({
			write() {},
		});

		try {
			await download.body
				.pipeThrough(pausableProgress)
				.pipeTo(streamnull, { signal: ac.signal });
		} catch (err) {
			if ((err as any)?.name !== "AbortError") throw err;
		}
		entry.cancel = undefined;
		entry.pause = undefined;
		entry.progress = undefined;
		entry.progressbytes = undefined;
		entry.paused = false;
		showDownloadsPopup();
		setTimeout(() => {
			this.downloadProgress = 0;
		}, 1000);
	}

	serialize(): SerializedBrowser {
		return {
			tabs: this.tabs.map((t) => t.serialize()),
			activetab: this.activetab.id,
			globalhistory: this.globalhistory.map((s) => s.serialize()),
			bookmarks: this.bookmarks,
			settings: { ...this.settings },
			globalDownloadHistory: this.globalDownloadHistory,
		};
	}
	deserialize(de: SerializedBrowser) {
		this.tabs = [];
		this.globalhistory = de.globalhistory.map((s) => {
			const state = new HistoryState();
			state.deserialize(s);
			return state;
		});
		for (let detab of de.tabs) {
			let tab = this.newTab();
			tab.deserialize(detab);
			tab.history.justTriggeredNavigation = true;
			tab.history.go(0, false);
		}
		this.activetab = this.tabs[0];
		this.bookmarks = de.bookmarks.map(createState);
		this.globalDownloadHistory = de.globalDownloadHistory.map(createState);
		this.settings = createState(de.settings);
		// this.activetab = this.tabs.find((t) => t.id == de.activetab)!;
	}

	newTab(url?: URL, focusomnibox: boolean = false) {
		let tab = new Tab(url);
		pushTab(tab);
		this.tabs = [...this.tabs, tab];
		this.activetab = tab;
		if (focusomnibox) focusOmnibox();
		return tab;
	}

	newTabRight(ref: Tab, url?: URL) {
		let tab = new Tab(url);
		pushTab(tab);
		let index = this.tabs.indexOf(ref);
		this.tabs.splice(index + 1, 0, tab);
		this.tabs = this.tabs;
		this.activetab = tab;
		return tab;
	}

	destroyTab(tab: Tab) {
		this.tabs = this.tabs.filter((t) => t !== tab);
		if (this.tabs.length === 0 && isPuter) {
			puter.exit();
		}

		if (this.activetab === tab) {
			this.activetab =
				this.tabs[0] || browser.newTab(new URL("puter://newtab"), true);
		}
		popTab(tab);
	}

	searchNavigate(url: string) {
		function validTld(hostname: string) {
			const res = tldts.parse(url);
			if (!res.domain) return false;
			if (res.isIp || res.isIcann) return true;
			return false;
		}

		// TODO: dejank
		if (URL.canParse(url)) {
			this.activetab.pushNavigate(new URL(url));
		} else if (
			URL.canParse("https://" + url) &&
			validTld(new URL("https://" + url).hostname)
		) {
			let fullurl = new URL("https://" + url);
			this.activetab.pushNavigate(fullurl);
		} else {
			const search = `https://google.com/search?q=${encodeURIComponent(url)}`;
			this.activetab.pushNavigate(new URL(search));
		}
	}
}

let loaded = false;
export async function saveBrowserState() {
	if (!loaded) return;

	let ser = browser.serialize();

	if (import.meta.env.VITE_LOCAL) {
		localStorage["browserstate"] = JSON.stringify(ser);
	} else {
		await puter.kv.set("browserstate", JSON.stringify(ser));
	}

	// if (!import.meta.env.VITE_LOCAL) {
	// 	let data = await serializeAll();
	// 	await puter.kv.set("browserdata", JSON.stringify(data));
	// }
}

export async function initBrowser() {
	browser = new Browser();

	// if (!import.meta.env.VITE_LOCAL) {
	// 	let de = await puter.kv.get("browserdata");
	// 	if (de) {
	// 		try {
	// 			await deserializeAll(JSON.parse(de));
	// 		} catch (e) {
	// 			console.error("Error while loading browser data:", e);
	// 		}
	// 	}
	// }

	let de;
	if (import.meta.env.VITE_LOCAL) {
		de = localStorage["browserstate"];
	} else {
		de = await puter.kv.get("browserstate");
	}
	if (de) {
		try {
			browser.deserialize(JSON.parse(de));
		} catch (e) {
			console.error(e);
			console.error("Error while loading browser state. Resetting...");

			browser = new Browser();
			let tab = browser.newTab();
			browser.activetab = tab;
		}
	} else {
		let tab = browser.newTab();
		browser.activetab = tab;
	}

	(self as any).browser = browser;
	loaded = true;
}
