import { createState, type Stateful } from "dreamland/core";
import { ThemeVars, type Theme } from "./ui/theme";
import { Tab, Tabs } from "./tabs";

class StatefulClass {
	constructor(state: Stateful<any>) {
		return state;
	}
}

export class Browser extends StatefulClass {
	built: boolean = false;

	theme: Theme;
	constructor(state: Stateful<any>) {
		super(state);

		this.theme = {
			frame_bg: [40, 40, 40],
			toolbar_bg: [60, 60, 60],
			toolbar_button_fg: [199, 199, 199],
			toolbar_fg: [199, 199, 199],

			inactive_tab_bg: [40, 40, 40],
			inactive_tab_fg: [199, 199, 199],
			active_tab_fg: [227, 227, 227],

			button_bg: [60, 60, 60],

			ntp_bg: [60, 60, 60],
			ntp_fg: [232, 234, 237],
			ntp_link_fg: [138, 180, 248],

			omnibox_bg: [40, 40, 40],
			omnibox_fg: [227, 227, 227],

			bookmark_fg: [199, 199, 199],
		};
	}

	build(): HTMLElement {
		if (this.built) throw new Error("already built");
		this.built = true;

		return (
			<div>
				<ThemeVars colors={use(this.theme)} />
				<Tabs />
			</div>
		);
	}
}

export function createBrowser(): Browser {
	let browser = new Browser(createState({}));
	Object.setPrototypeOf(browser, Browser.prototype);
	return browser;
}
