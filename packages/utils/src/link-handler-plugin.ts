import { ManagedPlugin } from "@mercuryworkshop/scramjet-controller";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import type { AddAlwaysLastEventListener } from "./alwaysLastBubble";
import { EventHandlerPlugin } from "./event-handler-plugin";

export type LinkHandlerPluginOptions = {};

/**
 * Intercepts anchor clicks and middle-clicks so they open in a new tab via a
 * callback instead of the browser default. Requires {@link EventHandlerPlugin}
 * on the same frame.
 */
export class LinkHandlerPlugin extends ManagedPlugin {
	constructor(
		private onNewTab: (url: string) => void,
		private options: LinkHandlerPluginOptions = {}
	) {
		super("link-handler", ["event-handler"]);
	}

	install(frame: Frame): void {
		this.tap(
			frame.hooks.init.post,
			(_context) => {
				const eventHandler = frame.plugins.find(
					(p): p is EventHandlerPlugin => p.name === "event-handler"
				)!;
				const attachAnchorListeners = (node: HTMLAnchorElement) => {
					const openInNewTab = () => {
						this.onNewTab(node.href);
					};

					eventHandler.addEventListener(node, "click", (e: MouseEvent) => {
						if (e.button !== 0) return;
						e.preventDefault();
						e.stopPropagation();
						e.stopImmediatePropagation();
						openInNewTab();
					});

					eventHandler.addEventListener(node, "auxclick", (e: MouseEvent) => {
						if (e.button !== 1) return;
						e.preventDefault();
						e.stopPropagation();
						e.stopImmediatePropagation();
						openInNewTab();
					});
				};

				const anchorObserver = new MutationObserver((mutations) => {
					mutations.forEach((mutation) => {
						// https://issues.chromium.org/issues/440360422
						setTimeout(() => {
							mutation.addedNodes.forEach((_node) => {
								const node = _node as HTMLAnchorElement;
								if ("tagName" in node && node.tagName == "A") {
									attachAnchorListeners(node);
								}
							});
						}, 2000);
					});
				});
				anchorObserver.observe(window.document, {
					childList: true,
					subtree: true,
				});

				window.addEventListener("load", () => {
					window.document.querySelectorAll("*").forEach((e) => e);
				});
			},
			{ after: ["event-handler"] }
		);
	}
}
