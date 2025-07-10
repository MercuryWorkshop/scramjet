import { createState, type Stateful } from "dreamland/core";
import { ThemeVars, type Theme } from "./ui/theme";
import { Tabs, Tab } from "./tabs";
import { IconButton, Omnibox } from "./Omnibox";
import { scramjet } from "./main";
import iconAdd from "@ktibow/iconset-material-symbols/add";

class StatefulClass {
	constructor(state: Stateful<any>) {
		return state;
	}
}

export class Browser extends StatefulClass {
	built: boolean = false;

	theme: Theme;
	tabs: Tab[] = [];
	activetab: number;

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

	newTab(title: string) {
		let frame = scramjet.createFrame();
		let tab = new Tab(title, frame);
		this.tabs = [...this.tabs, tab];
		return tab;
	}

	build(): HTMLElement {
		let tab = this.newTab("title");
		this.activetab = tab.id;
		if (this.built) throw new Error("already built");
		this.built = true;

		return (
			<div>
				<ThemeVars colors={use(this.theme)} />
				<div style="display: flex">
					<Tabs
						tabs={use(this.tabs).bind()}
						activetab={use(this.activetab).bind()}
					/>
					<IconButton
						icon={iconAdd}
						click={() => {
							this.newTab("tab 2");
						}}
					></IconButton>
				</div>
				<Omnibox />
			</div>
		);
	}
}

export function createBrowser(): Browser {
	let browser = new Browser(createState({}));
	Object.setPrototypeOf(browser, Browser.prototype);
	return browser;
}
