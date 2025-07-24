import { createState, type Stateful } from "dreamland/core";
import { ThemeVars, type Theme } from "./theme";
import { Tabs } from "./components/TabStrip";
import { Omnibox } from "./components/Omnibox";
import { browser, scramjet } from "./main";
import iconAdd from "@ktibow/iconset-ion/add";
import { Shell } from "./components/Shell";
import { createMenu } from "./components/Menu";
import { StatefulClass } from "./StatefulClass";
import { Tab, type SerializedTab } from "./Tab";
import { createDelegate } from "dreamland/core";

export const pushTab = createDelegate<Tab>();
export const popTab = createDelegate<Tab>();
export const forceScreenshot = createDelegate<Tab>();

export const saveBrowserState = createDelegate<void>();

export type SerializedBrowser = {
	tabs: SerializedTab[];
	activetab: number;
};

export class Browser extends StatefulClass {
	built: boolean = false;

	theme: Theme;
	tabs: Tab[] = [];
	activetab: Tab;

	unfocusframes: boolean = false;

	constructor(state: Stateful<any>) {
		super(state);

		this.theme = {
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
		};
	}

	serialize(): SerializedBrowser {
		return {
			tabs: this.tabs.map((t) => t.serialize()),
			activetab: this.activetab.id,
		};
	}
	deserialize(de: SerializedBrowser) {
		this.tabs = [];
		for (let detab of de.tabs) {
			let tab = this.newTab();
			console.log(tab);
			tab.deserialize(detab);
		}
		this.activetab = this.tabs[0]; // TODO
		// this.activetab = this.tabs.find((t) => t.id == de.activetab)!;
		console.log(this.activetab, this.activetab.url);
	}

	newTab(url?: URL) {
		let tab = new Tab(url);
		pushTab(tab);
		this.tabs = [...this.tabs, tab];
		this.activetab = tab;
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
		console.log(this.tabs);
		if (this.activetab === tab) {
			this.activetab = this.tabs[0] || this.newTab();
		}
		popTab(tab);
	}

	build(): HTMLElement {
		let shell = <Shell tabs={use(this.tabs)} activetab={use(this.activetab)} />;

		let de = localStorage["browserstate"];
		if (de) {
			browser.deserialize(JSON.parse(de));
		} else {
			let tab = this.newTab();
			this.activetab = tab;
		}

		if (this.built) throw new Error("already built");
		this.built = true;

		return (
			<div>
				<ThemeVars colors={use(this.theme)} />
				<Tabs
					tabs={use(this.tabs).bind()}
					activetab={use(this.activetab).bind()}
					destroyTab={(tab) => this.destroyTab(tab)}
					addTab={() => this.newTab()}
				/>
				<Omnibox
					tabUrl={use(this.activetab.url)}
					canGoBack={use(this.activetab.canGoBack)}
					canGoForwards={use(this.activetab.canGoForward)}
					goBack={() => {
						this.activetab.back();
					}}
					goForwards={() => {
						this.activetab.forward();
					}}
					refresh={() => {
						this.activetab.frame.reload();
					}}
					navigate={(url: string) => {
						// TODO: dejank
						if (URL.canParse(url)) {
							this.activetab.pushNavigate(new URL(url));
						} else {
							const search = `https://google.com/search?q=${encodeURIComponent(url)}`;
							this.activetab.pushNavigate(new URL(search));
						}
					}}
				/>
				{shell}
			</div>
		);
	}
}

export function createBrowser(): Browser {
	let browser = new Browser(createState({}));
	Object.setPrototypeOf(browser, Browser.prototype);

	return browser;
}

saveBrowserState.listen(() => {
	let ser = browser.serialize();
	localStorage["browserstate"] = JSON.stringify(ser);
});
setInterval(saveBrowserState, 1000);
