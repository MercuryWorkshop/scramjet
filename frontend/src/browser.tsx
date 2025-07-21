import { createState, type Stateful } from "dreamland/core";
import { ThemeVars, type Theme } from "./theme";
import { Tabs } from "./components/TabStrip";
import { Omnibox } from "./components/Omnibox";
import { scramjet } from "./main";
import iconAdd from "@ktibow/iconset-ion/add";
import { Shell } from "./components/Shell";
import { createMenu } from "./components/Menu";
import { StatefulClass } from "./StatefulClass";
import { Tab } from "./Tab";
import { createDelegate } from "dreamland/utils";

export const pushTab = createDelegate<Tab>();
export const popTab = createDelegate<Tab>();

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

	newTab() {
		let tab = new Tab();
		pushTab(tab);
		this.tabs = [...this.tabs, tab];
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

		let tab = this.newTab();
		this.activetab = tab;
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
						this.activetab.history.go(-1);
					}}
					goForwards={() => {
						this.activetab.history.go(1);
					}}
					refresh={() => {
						this.activetab.frame.reload();
					}}
					navigate={(url: string) => {
						if (URL.canParse(url)) {
							this.activetab.history.push(new URL(url), undefined, true);
						} else {
							const search = `https://google.com/search?q=${encodeURIComponent(url)}`;
							this.activetab.history.push(new URL(search), undefined, true);
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
