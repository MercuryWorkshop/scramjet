import { createState, type Stateful } from "dreamland/core";
import { ThemeVars, type Theme } from "./ui/theme";
import { Tabs, Tab } from "./tabs";
import { IconButton, Omnibox } from "./Omnibox";
import { scramjet } from "./main";
import iconAdd from "@ktibow/iconset-material-symbols/add";
import { popTab, pushTab, Shell } from "./Shell";
import { createMenu } from "./Menu";

// let a = createState({
// 	b: createState({
// 		c: "test",
// 	}),
// });
// use(a.b.c).listen((v) => {
// 	console.log("a.b.c changed to", v);
// });
// a.b.c = "test2";

class StatefulClass {
	constructor(state: Stateful<any>) {
		return state;
	}
}

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

	newTab(title: string) {
		let frame = scramjet.createFrame();
		let tab = new Tab(title, frame);
		frame.go("https://google.com");
		frame.addEventListener("navigate", (e) => {
			console.error(e);
			tab.url = frame.client.url.href;
		});
		frame.frame.addEventListener("load", (e) => {
			tab.url = frame.client.url.href;
		});
		let browser = this;

		frame.addEventListener("contextInit", (ctx) => {
			ctx.client.Proxy("window.open", {
				apply(pctx) {
					let tab = browser.newTab("_blank");
					tab.frame.go(pctx.args[0]);

					// this is a bit jank: we need the global proxy NOW, but it will only load naturally after a few seconds
					const realContentWindow = tab.frame.frame.contentWindow;
					// :(
					const ctor: any = ctx.client.constructor;
					// see open.ts
					const newclient = new ctor(realContentWindow);
					newclient.hook();

					pctx.return(newclient.globalProxy);
				},
			});

			const framedoc = ctx.window.document;

			framedoc.addEventListener("contextmenu", (e) => {
				// need to calculate the real position of the frame relative to the top
				let xoff = 0;
				let yoff = 0;
				let currentwin = ctx.window;
				while (currentwin.parent && currentwin.frameElement) {
					// this will return true until the end of the scramjet boundary
					let { x, y } = currentwin.frameElement.getBoundingClientRect();
					xoff += x;
					yoff += y;
					currentwin = currentwin.parent;
				}
				// parent is trapped, so it won't calculate the topmost iframe. do that manually
				let { x, y } = frame.frame.getBoundingClientRect();
				xoff += x;
				yoff += y;
				createMenu(xoff + e.pageX, yoff + e.pageY, [
					{
						label: "Back",
						action: () => {
							frame.back();
						},
					},
					{
						label: "Forward",
						action: () => {
							frame.forward();
						},
					},
					{
						label: "Reload",
						action: () => {
							frame.reload();
						},
					},
					{
						label: "Bookmark",
						action: () => {
							console.log("Bookmarking", tab.title, tab.url);
						},
					},
				]);
				e.preventDefault();
			});
			const head = framedoc.querySelector("head")!;
			const observer = new MutationObserver(() => {
				const title = framedoc.querySelector("title");
				if (title) {
					tab.title = title.textContent || "New Tab";
				} else {
					tab.title = "New Tab";
				}
				const favicon = framedoc.querySelector(
					"link[rel='icon'], link[rel='shortcut icon']"
				);
				if (favicon) {
					const iconhref = favicon.getAttribute("href");
					if (iconhref) {
						const rewritten = scramjet.encodeUrl(
							new URL(iconhref, frame.client.url)
						);
						tab.icon = rewritten;
					} else {
						tab.icon = "/vite.svg";
					}
				} else {
					tab.icon = scramjet.encodeUrl(
						new URL("/favicon.ico", frame.client.url)
					);
				}
			});
			observer.observe(head, {
				childList: true,
				subtree: true,
			});
		});
		use(tab.url).listen(() => {
			this.activetab = this.activetab;
		});
		pushTab(tab);
		this.tabs = [...this.tabs, tab];
		this.activetab = tab;
		return tab;
	}

	navigate(url: string) {
		if (URL.canParse(url)) {
			this.activetab.frame.go(url);
		} else {
			const search = `https://google.com/search?q=${encodeURIComponent(url)}`;
			this.activetab.frame.go(search);
		}
	}

	destroyTab(tab: Tab) {
		this.tabs = this.tabs.filter((t) => t !== tab);
		console.log(this.tabs);
		if (this.activetab === tab) {
			this.activetab = this.tabs[0] || this.newTab("New Tab");
		}
		console.log(this.tabs);

		console.log(this.activetab);
		popTab(tab);
	}

	build(): HTMLElement {
		let shell = <Shell tabs={use(this.tabs)} activetab={use(this.activetab)} />;

		let tab = this.newTab("title");
		this.activetab = tab;
		if (this.built) throw new Error("already built");
		this.built = true;

		return (
			<div>
				<ThemeVars colors={use(this.theme)} />
				<div style="display: flex; align-items: center; background: var(--aboutbrowser-frame-bg)">
					<Tabs
						tabs={use(this.tabs).bind()}
						activetab={use(this.activetab).bind()}
						destroyTab={(tab) => this.destroyTab(tab)}
					/>
					<IconButton
						icon={iconAdd}
						click={() => {
							this.newTab("tab 2");
						}}
					></IconButton>
				</div>
				<Omnibox
					value={use(this.activetab.url)}
					navigate={(url) => this.navigate(url)}
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
