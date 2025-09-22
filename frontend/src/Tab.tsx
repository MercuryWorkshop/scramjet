import { createDelegate, createState } from "dreamland/core";
import { StatefulClass } from "./StatefulClass";
import { browser } from "./Browser";
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
import { SettingsPage } from "./pages/SettingsPage";
import { scramjet, serviceWorkerReady } from "./main";
import { DownloadsPage } from "./pages/DownloadsPage";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconBookmark from "@ktibow/iconset-ion/bookmark-outline";
import iconCode from "@ktibow/iconset-ion/code-outline";
import iconLink from "@ktibow/iconset-ion/link-outline";
import iconAdd from "@ktibow/iconset-ion/duplicate-outline";
import iconCopy from "@ktibow/iconset-ion/copy-outline";
import iconSave from "@ktibow/iconset-ion/save-outline";

const requestInspectElement = createDelegate<[HTMLElement, Tab]>();

import {
	type ScramjetClient,
	type ScramjetFrame,
} from "@mercuryworkshop/scramjet";

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

	icon: string;
	justCreated: boolean = true;

	history: History;

	canGoForward: boolean = false;
	canGoBack: boolean = false;

	internalpage: HTMLElement | null;

	devtoolsOpen: boolean = false;
	devtoolsWidth = 200;

	loadProgress: number = 0;
	loadProgressTarget: number = 0;

	sendToChobitsu: ((message: string) => void) | null = null;
	onChobitsuMessage: ((message: string) => void) | null = null;
	waitForChobitsuInit: Promise<void>;

	constructor(public url: URL = new URL("puter://newtab")) {
		super(createState(Object.create(Tab.prototype)));

		this.id = id++;

		this.title = null;
		this.internalpage = null;

		const frame = scramjet.createFrame();
		this.frame = frame;

		this.history = new History(this);
		this.history.push(this.url, undefined);

		this.icon = "/defaultfavicon.png";

		this.dragoffset = -1;
		this.startdragpos = -1;
		this.dragpos = -1;
		this.width = 0;
		this.pos = 0;

		let resolver: () => void;
		this.waitForChobitsuInit = new Promise((resolve) => {
			resolver = resolve;
		});

		addHistoryListeners(frame, this);
		let injected = false;

		this.loadProgress = 0;
		this.loadProgressTarget = 0;
		const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
		const finishLoad = () => {
			this.loadProgress = 1;
			setTimeout(() => {
				this.loadProgress = 0;
				this.loadProgressTarget = 0;
			}, 250);
		};
		setInterval(() => {
			if (this.loadProgress < this.loadProgressTarget) {
				this.loadProgress = lerp(
					this.loadProgress,
					this.loadProgressTarget,
					0.01
				);
				if (Math.abs(this.loadProgress - this.loadProgressTarget) < 0.01) {
					this.loadProgress = this.loadProgressTarget;
				}
			}
		}, 16);

		frame.addEventListener("contextInit", (ctx) => {
			injectContextMenu(ctx.client, this);
			injectWindowFill(ctx.client, this);
			injectAnchorHandler(ctx.client, this);

			// make sure it's top level, ctxInit calls for all frames too
			if (ctx.window == frame.frame.contentWindow) {
				if (this.history.justTriggeredNavigation) {
					// url bar was typed in, we triggered this navigation, don't push a new state since we already did
					this.history.justTriggeredNavigation = false;
				} else {
					// the page just loaded on its own (a link was clicked, window.location was set)
					this.history.push(ctx.client.url, undefined, false);
				}

				this.loadProgressTarget = 0.2;
				ctx.client.global.addEventListener("load", (e) => {
					if (!e.isTrusted) return;
					finishLoad();
				});
				ctx.client.global.addEventListener("DOMContentLoaded", (e) => {
					if (!e.isTrusted) return;
					this.loadProgressTarget = 0.8;
				});
				setTimeout(() => {
					finishLoad();
				}, 5000); // failsafe 5 seconds in case the page just never fires load for some reason

				injectChobitsu(ctx.client, this, resolver);
				injectTitleWatcher(ctx.client, this);
				injectHistoryEmulation(ctx.client, this);

				use(this.devtoolsOpen).listen((open) => {
					if (!open || injected) return;
					injected = true;
					injectDevtools(ctx.client, this);
				});
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
		this._directnavigate(this.history.states[this.history.index].url);
	}

	// only caller should be history.ts for this
	_directnavigate(url: URL) {
		this.url = url;
		if (url.protocol == "puter:") {
			switch (url.host) {
				case "newtab":
					this.history.current().title = this.title = "New Tab";
					this.internalpage = <NewTabPage tab={this} />;
					break;
				case "playground":
					this.history.current().title = this.title = "Scramjet Playground";
					this.internalpage = <PlaygroundPage tab={this} />;
					break;
				case "history":
					this.history.current().title = this.title = "Browser History";
					this.internalpage = <HistoryPage tab={this}></HistoryPage>;
					break;
				case "version":
					this.history.current().title = this.title = "About Version";
					this.internalpage = <AboutPage tab={this} />;
					break;
				case "settings":
					this.history.current().title = this.title = "Settings";
					this.internalpage = <SettingsPage tab={this} />;
					break;
				case "downloads":
					this.history.current().title = this.title = "Downloads";
					this.internalpage = <DownloadsPage tab={this} />;
			}
		} else {
			this.internalpage = null;
			// placeholder title until the page fills in
			this.title = url.href;

			if (!navigator.serviceWorker.controller) {
				serviceWorkerReady.then(() => {
					this.frame.go(url);
				});
			} else {
				this.frame.go(url);
			}
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

function injectWindowFill(client: ScramjetClient, tab: Tab) {
	client.Proxy("window.open", {
		apply(ctx) {
			let tab = browser.newTab(ctx.args[0] || new URL("about:blank"));

			// this is a bit jank: we need the global proxy NOW, but it will only load naturally after a few seconds
			const realContentWindow = tab.frame.frame.contentWindow;
			// :(
			const ctor: any = client.constructor;
			// see open.ts
			const newclient = new ctor(realContentWindow);
			newclient.hook();

			ctx.return(newclient.global);
		},
	});
}

function injectChobitsu(
	client: ScramjetClient,
	tab: Tab,
	resolver: () => void
) {
	console.log("injecting chobitsu");
	// the fake origin is defined in sw.js
	const devtoolsUrl = "https://fake-devtools.invalid";
	// make sure to create the element through the proxied document
	let devtoolsScript = client.global.document.createElement("script");
	devtoolsScript.setAttribute("src", devtoolsUrl + "/page_inject.js");
	client.global.document.head.appendChild(devtoolsScript);

	// page needs to know what its id is so it can send to playwright properly
	// @ts-expect-error
	client.global.$chobitsuPageId = String(tab.id);

	// @ts-expect-error
	client.global.$onChobitsuMessage = (message: string) => {
		if (tab.onChobitsuMessage) tab.onChobitsuMessage(message);
	};

	// @ts-expect-error
	client.global.$onChobitsuInit = () => {
		resolver();
	};
	tab.sendToChobitsu = (message: string) => {
		console.warn(message);
		// @ts-expect-error
		client.global.$sendToChobitsu(message);
	};
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
	// we're loading the entire bundle through scramjet so that eval() will be rewritten
	// if the frame is about:blank it won't have a client yet, so we need to create one
	// to start, apply the same hack as window.open to scramjetify the devtools frame
	const contentwindow = tab.devtoolsFrame.frame.contentWindow;
	const ctor: any = client.constructor;
	devtoolsFrameClient = new ctor(contentwindow);
	// TODO i should probably put this in core
	devtoolsFrameClient.hook();

	// the fake origin is defined in sw.js, it fetches from /public
	const devtoolsUrl = "https://fake-devtools.invalid/chii";
	// make sure to create the element through the proxied document
	let devtoolsScript = client.global.document.createElement("script");
	devtoolsScript.setAttribute("src", devtoolsUrl + "/target.js");
	devtoolsScript.setAttribute("embedded", "true");

	// the devtools frontend will try to run `window.parent.postMessage` to communicate with the chobitsu server
	// this will not work since it's being sandboxed, so window.parent is just itself
	let hookedPostMessageListener: (data: any) => void;
	tab.devtoolsFrame.addEventListener("contextInit", (e) => {
		// instead, overwrite its postMessage, and then forward it directly to the main window
		e.window.postMessage = (data: any, origin: string) => {
			client.global.window.postMessage(data);
		};

		// of course since we overwrote postmessage, the main window won't be able to postmessage to it since it will just call that function
		// so first, manually grab the listener when it tries to register it
		e.client.Proxy("window.addEventListener", {
			apply(ctx) {
				if (ctx.args[0] == "message") {
					hookedPostMessageListener = ctx.args[1];
					ctx.return(undefined);
				}
			},
		});
	});

	// this is needed because if the top level scramjet frame happened to be sandboxed, the target iframe will be blocked from navigating its "ancestor" devtools frame
	devtoolsFrameClient.natives.call(
		"eval",
		null,
		`
    window.addEventListener("message", (e) => {
      if (e.data && e.data.$type === "navigate") {
        window.location = e.data.value;
      }
    });
  `
	);
	// VERY IMPORTANT: GIVE CHII THE *PROXIED* VERSION OF THE DEVTOOLS FRAME, AND NO REAL CTORS
	// this is needed for the interceptors to work - but also stops sbx
	//@ts-expect-error
	client.global.ChiiDevtoolsIframe = {
		// give the window a copy of the frame window that uses our postmessage instead of the normal one, which was just overwritten previously
		contentWindow: {
			...devtoolsFrameClient.global,
			// this is just some artifacts from rewriting don't worry about it
			$scramjet$setrealm() {
				return {
					postMessage(data: any, origin: string) {
						// call the function we grabbed earlier
						hookedPostMessageListener(
							new MessageEvent("message", {
								// we also can set origin here so we don't have to patch the check in sdk
								origin: client.global.origin,
								data,
							})
						);
					},
				};
			},
		},
		// TODO this is STILL sbx annoyingly because the functions don't have their ctors intercepted
		set src(value) {
			console.log(devtoolsFrameClient);
			console.log(scramjet.encodeUrl(value));
			devtoolsFrameClient.natives.call(
				"window.postMessage",
				devtoolsFrameClient.global,
				{ $type: "navigate", value: scramjet.encodeUrl(value) },
				"*"
			);
		},
		get src() {
			return devtoolsFrameClient.url;
		},
	};
	client.global.document.head.appendChild(devtoolsScript);

	// requestInspectElement.listen(([elm, t]) => {
	// 	if (t != tab) return;
	// 	// @ts-expect-error
	// 	client.global.window.$chiiSendToDevtools("Overlay.inspectNodeRequested", {
	// 		// @ts-expect-error
	// 		backendNodeId: client.global.pushNodesToFrontend(elm),
	// 	});
	// });
}

function injectAnchorHandler(client: ScramjetClient, tab: Tab) {
	// goal is to override the default behavior of clicking on an <a> link
	// if the link is target=_blank it needs to open in a new browser.js tab instead of a native tab
	// the browser does not provide a neat way of knowing when a link is clicked through
	//
	// so the only solution left is to addEventListener("click") on every single <a> element
	// however, this presents an issue
	// if the page has its *own* event listener, and it calls e.preventDefault(), we need to not open the tab, since we're essentially acting as the new default
	// since events bubble down and can have non trivial control flows, this gets complicated fast
	//
	// the only solution is to register both the first and last event listeners, so that you control the entire call stack
	// registering the first is easy, you just need to call it immediately after creation
	// registering the *last* is extremely difficult

	type EvtDesc = {
		originalcb: (e: Event) => void;
		injectafter?: (e: MouseEvent) => void;
	};
	let currentlyExecutingDesc: EvtDesc | null = null;
	const eventListeners: Map<EventTarget, EvtDesc[]> = new Map();
	// start by recording every click event registered so that we can rebuild the bubble path later
	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			if (ctx.args[0] != "click") return;
			// capture events don't go through the bubble process so we shouldn't include them
			if (
				(typeof ctx.args[2] === "boolean" && ctx.args[2]) ||
				(typeof ctx.args[2] === "object" && ctx.args[2].capture)
			)
				return;

			let cb = ctx.args[1];
			ctx.args[1] = function (...args: any) {
				// will always exist since we set it just below
				let descs = eventListeners.get(ctx.this)!;
				// find the one talking about us
				let desc = descs.find((d) => d.originalcb === cb)!;

				// have a flag for the event that's currently running so that we know where we are in the stack if preventDefault() or stopPropagation() is called
				currentlyExecutingDesc = desc;
				if (typeof cb === "function") {
					Reflect.apply(cb, this, args);
				} else if (typeof cb === "object" && cb !== null && cb.handleEvent) {
					Reflect.apply(cb.handleEvent, this, args);
				}

				if (desc.injectafter) {
					desc.injectafter(args[0]);
					delete desc.injectafter;
				}
				currentlyExecutingDesc = null;
			};

			let desc = {
				originalcb: cb,
			};

			if (eventListeners.has(ctx.this)) {
				eventListeners.get(ctx.this)!.push(desc);
			} else {
				eventListeners.set(ctx.this, [desc]);
			}
		},
	});

	const anchorObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			setTimeout(() => {
				mutation.addedNodes.forEach((_node) => {
					let node: HTMLAnchorElement = _node as any;
					if ("tagName" in node && node.tagName == "A") {
						const openInNewTab = () => {
							const href = scramjet.decodeUrl(node.href);
							browser.newTab(
								new URL(URL.canParse(href) ? href : "about:blank")
							);
						};

						const iAmLastListener = (e: MouseEvent) => {
							if (node.target != "_blank") return;
							if (e.defaultPrevented) return; // our behavior is what the new "default" is, so we don't want to trigger
							e.preventDefault();
							e.stopImmediatePropagation(); // for good measure
							openInNewTab();
						};

						// this event will always run before all other ones, since it was registered at injectHistoryEmulation
						// * unless you registered the event before appending to the dom
						// * unless there's something inside of the <a> that has a listener on it
						// * unless there's a capture listener
						// TODO fix those cases

						client.natives.call(
							"EventTarget.prototype.addEventListener",
							node,
							"click",
							(e: MouseEvent) => {
								let lastlistener;
								const path = e.composedPath();

								// travel the path, from the <a> all the way to Window
								for (const elm of path) {
									let descriptors = eventListeners.get(elm);
									if (descriptors) {
										// last descriptor was last added and will be called last
										lastlistener = descriptors[descriptors.length - 1];
									}
								}

								// TODO: if a listener is added to a lower level of the dom inside the listener of a higher level, our lastlistener will not be correct
								if (!lastlistener) {
									// there are no other event listeners! great
									iAmLastListener(e);
								} else {
									// we know what the last listener is. run this to inject after it
									lastlistener.injectafter = (e) => {
										iAmLastListener(e);
									};
								}

								// except, if stopPropagation is called, it never gets to the lastlistener
								client.RawProxy(e, "stopImmediatePropagation", {
									apply() {
										if (!currentlyExecutingDesc)
											throw new Error(
												"stopImmediatePropagation called but no desc found?"
											);
										// for stopImmediatePropagation this is the last one
										currentlyExecutingDesc.injectafter = (e) => {
											// in case preventDefault is called after stopImmediatePropagation(), wait for the event handler to be done
											iAmLastListener(e);
										};
									},
								});
								client.RawProxy(e, "stopPropagation", {
									apply(ctx) {
										if (!currentlyExecutingDesc)
											throw new Error(
												"stopPropagation called but no desc found?"
											);
										// stopPropagation means there might still be more listeners on the same element
										// find whatever the last one is on the this element and then inject after it too

										let ev: Event = ctx.this;
										if (!ev.target) throw new Error("no target");
										let descs = eventListeners.get(ev.target);
										if (!descs)
											throw new Error("no descs found in stopPropagation()");
										let idx = descs.indexOf(currentlyExecutingDesc);
										if (idx == -1)
											throw new Error("couldn't find currentlyExecutingDesc");
										let remaining = descs.slice(idx + 1, descs.length);
										if (remaining.length > 0) {
											let last = remaining[remaining.length - 1];
											// finally we have the last in the chain after propagation is cut off
											last.injectafter = (e) => {
												iAmLastListener(e);
											};
										}
									},
								});
							}
						);
						// TODO: jankify this too
						client.natives.call(
							"EventTarget.prototype.addEventListener",
							node,
							"auxclick",
							(e: MouseEvent) => {
								if (e.button !== 1) return; // middle click
								e.preventDefault();
								openInNewTab();
							}
						);
					}
				});
			}, 2000);
		});
	});
	anchorObserver.observe(client.global.document, {
		childList: true,
		subtree: true,
	});

	client.global.addEventListener("load", () => {
		client.global.document.querySelectorAll("*").forEach((e) => e);
	});
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
	} else if (target && target instanceof view.HTMLAnchorElement) {
		let href = Object.getOwnPropertyDescriptor(
			HTMLAnchorElement.prototype,
			"href"
		)!.get!.call(target);
		let url = scramjet.decodeUrl(href);
		return [
			{
				label: "Open Link",
				action: () => {
					if (url) {
						browser.activetab.pushNavigate(new URL(url));
					}
				},
				icon: iconLink,
			},
			{
				label: "Open Link in New Tab",
				action: () => {
					if (url) {
						browser.newTab(new URL(url));
					}
				},
				icon: iconAdd,
			},
			{
				label: "Copy Link Address",
				action: () => {
					navigator.clipboard.writeText(scramjet.decodeUrl(target.href));
				},
				icon: iconCopy,
			},
			{
				label: "Save Link As...",
				action: () => {
					// TODO
				},
				icon: iconSave,
			},
		];
	}

	return [
		{
			label: "Back",
			action: () => {
				tab.back();
			},
			icon: iconBack,
		},
		{
			label: "Forward",
			action: () => {
				tab.forward();
			},
			icon: iconForwards,
		},
		{
			label: "Reload",
			action: () => {
				tab.reload();
			},
			icon: iconRefresh,
		},
		{
			label: "Bookmark",
			action: () => {
				// TODO:
				console.log("Bookmarking", tab.title, tab.url);
			},
			icon: iconBookmark,
		},
		{
			label: "Inspect",
			action: () => {
				tab.devtoolsOpen = true;
				if (e.target) requestInspectElement([e.target as HTMLElement, tab]);
			},
			icon: iconCode,
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
			{ left: xoff + e.clientX, top: yoff + e.clientY },
			pageContextItems(client, tab, e)
		);
		e.preventDefault();
	});
}

function injectTitleWatcher(client: ScramjetClient, tab: Tab) {
	const framedoc = client.global.document;
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
				tab.icon = "/defaultfavicon.png";
			}
		} else {
			// check if there's a favicon.ico
			let img = new Image();
			img.src = scramjet.encodeUrl(new URL("/favicon.ico", client.url));
			img.onload = () => {
				tab.icon = scramjet.encodeUrl(new URL("/favicon.ico", client.url));
			};
			img.onerror = () => {
				// nope...
			};
		}
		tab.history.current().title = tab.title;
		tab.history.current().favicon = tab.icon;
	});
	observer.observe(framedoc, {
		childList: true,
		subtree: true,
	});
}
