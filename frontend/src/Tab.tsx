import { createDelegate, createState } from "dreamland/core";
import { StatefulClass } from "./StatefulClass";
import { browser, scramjet } from "./main";
import {
	addHistoryListeners,
	History,
	injectHistoryEmulation,
	type SerializedHistory,
} from "./History";
import { NewTabPage } from "./pages/NewTabPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { createMenu } from "./components/Menu";
import { AboutPage } from "./pages/AboutPage";
import { HistoryPage } from "./pages/HistoryPage";

const requestInspectElement = createDelegate<[HTMLElement, Tab]>();

export type SerializedTab = {
	id: number;
	title: string | null;
	history: SerializedHistory;
};

let id = 100;
export class Tab extends StatefulClass {
	id: number;
	title: string | null;
	frame: ScramjetFrame;
	devtoolsFrame: ScramjetFrame;
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

	devtoolsOpen: boolean = false;
	devtoolsWidth = 200;

	constructor(public url: URL = new URL("puter://newtab")) {
		super(createState(Object.create(Tab.prototype)));

		this.id = id++;

		this.title = null;
		this.internalpage = null;

		const frame = scramjet.createFrame();
		this.frame = frame;

		this.history = new History(this);
		this.history.push(this.url, undefined);

		this.icon = "/vite.svg";

		this.dragoffset = -1;
		this.startdragpos = -1;
		this.dragpos = -1;
		this.width = 0;
		this.pos = 0;

		addHistoryListeners(frame, this);
		frame.addEventListener("contextInit", (ctx) => {
			injectContextMenu(ctx.client, this);

			// make sure it's top level, ctxInit calls for all frames too
			if (ctx.window == frame.frame.contentWindow) {
				injectTitleWatcher(ctx.client, this);
				injectHistoryEmulation(ctx.client, this);
				// injectDevtools(ctx.client, this);
			}
		});

		this.devtoolsFrame = scramjet.createFrame();
	}

	serialize(): SerializedTab {
		return {
			id: this.id,
			title: this.title,
			history: this.history.serialize(),
		};
	}
	deserialize(de: SerializedTab) {
		// if (de.id >= id) id = de.id + 1;
		// this.id = de.id;
		this.title = de.title;
		this.history.deserialize(de.history);
		console.log(this.history.states[this.history.index].url);
		this._directnavigate(this.history.states[this.history.index].url);
	}

	// only caller should be history.ts for this
	_directnavigate(url: URL) {
		this.url = url;
		if (url.protocol == "puter:") {
			switch (url.host) {
				case "newtab":
					this.title = "New Tab";
					this.internalpage = <NewTabPage tab={this} />;
					break;
				case "playground":
					this.title = "Scramjet Playground";
					this.internalpage = <PlaygroundPage tab={this} />;
					break;
				case "history":
					this.title = "Browser History";
					this.internalpage = <HistoryPage tab={this}></HistoryPage>;
					break;
				case "version":
					this.title = "About Version";
					this.internalpage = <AboutPage tab={this} />;
			}
		} else {
			this.internalpage = null;
			// placeholder title until the page fills in
			this.title = url.href;
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

function injectDevtools(client: ScramjetClient, tab: Tab) {
	// right here there's three contexts, the main window, the page frame, and the empty devtools frame
	// chobitsu is injected into the page frame (loaded from https://fake-devtools.invalid/target.js), and then will try and inject
	// itself into the devtools frame through the `ChiiDevtoolsIframe` global variable
	// so first we need to make sure that the devtools frame is in a scramjet context so that the page frame will use proxied apis
	// then we set up communication between the devtools frame and the page frame
	// then, hand off the devtools frame to the page frame so that it can inject itself into it, but cannot use the globals to escape

	let devtoolsFrameClient: ScramjetClient;

	// listen to the *page's* beforeunload, so we can get rid of the previous scramjet client (and associated devtools frame) in time for the new site to load
	client.global.addEventListener("beforeunload", () => {
		console.log("before unload");
		tab.devtoolsFrame.frame.src = "about:blank";
	});
	// we're loading the entire bundle through scramjet so that eval() will  be rewritten
	// if the frame is about:blank it won't have a client yet, so we need to create one
	// to start, apply the same hack as window.open to scramjetify the devtools frame
	const contentwindow = tab.devtoolsFrame.frame.contentWindow;
	const ctor: any = client.constructor;
	devtoolsFrameClient = new ctor(contentwindow);
	// TODO i should probably put this in core
	devtoolsFrameClient.hook();

	// the fake origin is defined in sw.js
	const devtoolsUrl = "https://fake-devtools.invalid";
	// make sure to create the element through the proxied document
	let devtoolsScript = client.global.document.createElement("script");
	devtoolsScript.setAttribute("src", devtoolsUrl + "/target.js");
	devtoolsScript.setAttribute("embedded", "true");

	tab.devtoolsFrame.addEventListener("contextInit", (e) => {
		// devtools frontend will try to access the parent window's postMessage
		// this won't work, i manually patched it to use this global instead
		//@ts-expect-error
		e.window.parentPostMessage = (data: any, origin: string) => {
			// oh god
			// i will fix this later
			// we're not supposed to be postmessaging from a non-scramjet context into a scramjet one
			// so we need to trick the page content's scramjetclient into thinking this window is also a scramjet context
			//@ts-expect-error
			window[Symbol.for("scramjet client global")] = {
				// for our fake scramjet client in the main window, set the origin to the fake devtools url so that the event origin check will suceed
				url: { origin: devtoolsUrl },
			};
			//@ts-expect-error
			client.global.window.$scramjet$setrealm({}).postMessage(data);
			//@ts-expect-error
			delete window[Symbol.for("scramjet client global")];
		};
	});

	// VERY IMPORTANT: GIVE CHII THE *PROXIED* VERSION OF THE DEVTOOLS FRAME, AND NO REAL CTORS
	// this is needed for the interceptors to work - but also stops sbx
	//@ts-expect-error
	client.global.ChiiDevtoolsIframe = {
		contentWindow: devtoolsFrameClient.global,
		// TODO this is STILL sbx annoyingly because the functions don't have their ctors intercepted
		set src(value) {
			devtoolsFrameClient.url = value;
		},
		get src() {
			return devtoolsFrameClient.url;
		},
	};
	client.global.document.head.appendChild(devtoolsScript);
	requestInspectElement.listen(([elm, t]) => {
		if (t != tab) return;
		// @ts-expect-error
		client.global.window.connector1.default.trigger(
			"Overlay.inspectNodeRequested",
			{
				// @ts-expect-error
				backendNodeId: client.global.pushNodesToFrontend(elm),
			}
		);
	});

	// unproxied version
	// const devtoolsUrl = "/chi";
	// let devtoolsScript = document.createElement("script");
	// devtoolsScript.setAttribute("src", devtoolsUrl + "/target.js");
	// devtoolsScript.setAttribute("embedded", "true");

	// window.addEventListener("message", (event) => {
	// 	console.log(event.data);
	// 	client.global.window.postMessage(event.data, event.origin);
	// });

	// client.global.ChiiDevtoolsIframe = tab.devtoolsFrame;
	// client.global.document.head.appendChild(devtoolsScript);
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
		{
			label: "Inspect",
			action: () => {
				tab.devtoolsOpen = true;
				if (e.target) requestInspectElement([e.target as HTMLElement, tab]);
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

function injectTitleWatcher(client: ScramjetClient, tab: Tab) {
	const framedoc = client.global.document;
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
				const rewritten = scramjet.encodeUrl(new URL(iconhref, client.url));
				tab.icon = rewritten;
			} else {
				tab.icon = "/vite.svg";
			}
		} else {
			tab.icon = scramjet.encodeUrl(new URL("/favicon.ico", client.url));
		}
		tab.history.current().title = tab.title;
		tab.history.current().favicon = tab.icon;
	});
	observer.observe(head, {
		childList: true,
		subtree: true,
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
