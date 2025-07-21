import { createState } from "dreamland/core";
import { StatefulClass } from "./StatefulClass";
import { scramjet } from "./main";
import {
	addHistoryListeners,
	History,
	injectHistoryEmulation,
} from "./history";
import { NewTab } from "./pages/NewTab";
import { Playground } from "./pages/Playground";
import { createMenu } from "./components/Menu";

let id = 0;
export class Tab extends StatefulClass {
	id: number;
	title: string | null;
	frame: ScramjetFrame;
	screenshot: string | null = null;

	dragoffset: number;
	dragpos: number;
	startdragpos: number;

	width: number;
	pos: number;
	icon: string;

	history: History;

	canGoForward: boolean = false;
	canGoBack: boolean = false;

	internalpage: HTMLElement | null;

	constructor(public url: URL = new URL("puter://newtab")) {
		super(createState(Object.create(Tab.prototype)));

		this.id = id++;

		this.title = null;
		this.internalpage = null;

		this.history = new History(this);
		this.history.push(this.url, undefined);

		this.icon = "/vite.svg";

		this.dragoffset = -1;
		this.startdragpos = -1;
		this.dragpos = -1;
		this.width = 0;
		this.pos = 0;

		const frame = scramjet.createFrame();
		addHistoryListeners(frame, this);
		frame.addEventListener("contextInit", (ctx) => {
			injectHistoryEmulation(ctx.client, this);
			injectContextMenu(ctx.client, this);
		});

		this.frame = frame;
	}

	// only caller should be history.ts for this
	navigate(url: URL) {
		this.url = url;
		if (url.protocol == "puter:") {
			switch (url.host) {
				case "newtab":
					this.title = "New Tab";
					this.internalpage = <NewTab tab={this} />;
					break;
				case "playground":
					this.title = "Scramjet Playground";
					this.internalpage = <Playground tab={this} />;
					break;
			}
		} else {
			this.internalpage = null;
			this.frame.go(url);
		}
	}
}

function injectContextMenu(client: ScramjetClient, tab: Tab) {
	let frame = tab.frame;
	client.global.document.addEventListener("contextmenu", (e) => {
		// need to calculate the real position of the frame relative to the top
		let xoff = 0;
		let yoff = 0;
		let currentwin = client.global.window;
		while (currentwin.parent && currentwin.frameElement) {
			// this will return true until the end of the scramjet boundary
			let { x, y } = currentwin.frameElement.getBoundingClientRect();
			xoff += x;
			yoff += y;
			currentwin = currentwin.parent.window;
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
}

// 		frame.frame.addEventListener("load", (e) => {
// 			tab.url = frame.client.url.href;
// 		});
// 		let browser = this;

// 		frame.addEventListener("contextInit", (ctx) => {
// 			ctx.client.Proxy("window.open", {
// 				apply(pctx) {
// 					let tab = browser.newTab("_blank");
// 					tab.frame.go(pctx.args[0]);

// 					// this is a bit jank: we need the global proxy NOW, but it will only load naturally after a few seconds
// 					const realContentWindow = tab.frame.frame.contentWindow;
// 					// :(
// 					const ctor: any = ctx.client.constructor;
// 					// see open.ts
// 					const newclient = new ctor(realContentWindow);
// 					newclient.hook();

// 					pctx.return(newclient.globalProxy);
// 				},
// 			});

// 			const framedoc = ctx.window.document;

// 			const head = framedoc.querySelector("head")!;
// 			const observer = new MutationObserver(() => {
// 				const title = framedoc.querySelector("title");
// 				if (title) {
// 					tab.title = title.textContent || "New Tab";
// 				} else {
// 					tab.title = "New Tab";
// 				}
// 				const favicon = framedoc.querySelector(
// 					"link[rel='icon'], link[rel='shortcut icon']"
// 				);
// 				if (favicon) {
// 					const iconhref = favicon.getAttribute("href");
// 					if (iconhref) {
// 						const rewritten = scramjet.encodeUrl(
// 							new URL(iconhref, frame.client.url)
// 						);
// 						tab.icon = rewritten;
// 					} else {
// 						tab.icon = "/vite.svg";
// 					}
// 				} else {
// 					tab.icon = scramjet.encodeUrl(
// 						new URL("/favicon.ico", frame.client.url)
// 					);
// 				}
// 			});
// 			observer.observe(head, {
// 				childList: true,
// 				subtree: true,
// 			});
// 			const anchorObserver = new MutationObserver((mutations) => {
// 				mutations.forEach((mutation) => {
// 					mutation.addedNodes.forEach((node) => {
// 						if (node instanceof HTMLAnchorElement) {
// 							const openInNewTab = () => {
// 								const href = scramjet.decodeUrl(node.href);
// 								let newtab = this.newTab("title");
// 								if (href) {
// 									newtab.frame.go(href);
// 								} else {
// 									newtab.frame.go("about:blank");
// 								}
// 							};
// 							node.addEventListener("click", (e) => {
// 								if (node.target !== "_blank") return;
// 								e.preventDefault();
// 								openInNewTab();
// 							});
// 							node.addEventListener("auxclick", (e) => {
// 								if (e.button !== 1) return; // middle click
// 								e.preventDefault();
// 								openInNewTab();
// 							});
// 						}
// 					});
// 				});
// 			});
// 			anchorObserver.observe(framedoc, {
// 				childList: true,
// 				subtree: true,
// 			});
// 		});
// 		use(tab.url).listen(() => {
// 			this.activetab = this.activetab;
// 		});
