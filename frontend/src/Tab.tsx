import { createState } from "dreamland/core";
import { StatefulClass } from "./StatefulClass";
import { browser, scramjet } from "./main";
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
	_directnavigate(url: URL) {
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

	pushNavigate(url: URL) {
		this.history.push(url, undefined, true);
	}
	replaceNavigate(url: URL) {
		this.history.replace(url, undefined, true);
	}

	back() {
		if (this.canGoBack) {
			this.history.go(-1);
		}
	}
	forward() {
		if (this.canGoForward) {
			this.history.go(1);
		}
	}
	reload() {
		if (this.internalpage) {
			this._directnavigate(this.url);
		} else {
			this.frame.reload();
		}
	}
}

function copyImageToClipboard(img: HTMLImageElement) {
	if (!img.complete || !img.naturalWidth) {
		console.error("Image not loaded yet");
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		console.error("Failed to get canvas context");
		return;
	}

	ctx.drawImage(img, 0, 0);

	canvas.toBlob((blob) => {
		if (blob) {
			navigator.clipboard
				.write([
					new ClipboardItem({
						"image/png": blob,
					}),
				])
				.then(() => {
					console.log("Image copied to clipboard");
				})
				.catch((err) => {
					console.error("Failed to copy image to clipboard", err);
				});
		}
	}, "image/png");
}

function pageContextItems(client: ScramjetClient, tab: Tab, e: MouseEvent) {
	console.log(e.target);
	const selection = client.global.getSelection();
	if (selection && selection.toString().length > 0) {
		return [
			{
				label: "Search",
				action: () => {
					const query = selection.toString();
					if (query) {
						tab.pushNavigate(
							new URL(
								`https://www.google.com/search?q=${encodeURIComponent(query)}`
							)
						);
					}
				},
			},
			{
				label: "Copy",
				action: () => {
					navigator.clipboard.writeText(selection.toString());
				},
			},
		];
	}

	let target = e.target;
	let view = e.view!.window;
	// need to use e.view here they're different objects
	if (target && target instanceof view.HTMLImageElement) {
		return [
			{
				label: "Open Image in New Tab",
				action: () => {
					// TODO: this is broken lol
					const imgUrl = scramjet.decodeUrl(target.src);
					if (imgUrl) {
						let newTab = browser.newTab();
						newTab.pushNavigate(new URL(imgUrl));
					}
				},
			},
			{
				label: "Copy Image URL",
				action: () => {
					navigator.clipboard.writeText(scramjet.decodeUrl(target.src));
				},
			},
			{
				label: "Copy Image",
				action: () => {
					copyImageToClipboard(target);
				},
			},
			{
				label: "Save Image As...",
				action: () => {
					// TODO
				},
			},
		];
	}

	return [
		{
			label: "Back",
			action: () => {
				tab.back();
			},
		},
		{
			label: "Forward",
			action: () => {
				tab.forward();
			},
		},
		{
			label: "Reload",
			action: () => {
				tab.reload();
			},
		},
		{
			label: "Bookmark",
			action: () => {
				// TODO:
				console.log("Bookmarking", tab.title, tab.url);
			},
		},
	];
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

		createMenu(
			xoff + e.pageX,
			yoff + e.pageY,
			pageContextItems(client, tab, e)
		);
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
