import type { Component } from "dreamland/core";
import type { Tab } from "./TabStrip";
import { browser } from "../main";
import { popTab, pushTab } from "../browser";

export const Shell: Component<{
	tabs: Tab[];
	activetab: Tab;
}> = function (cx) {
	pushTab.listen((tab) => {
		tab.frame.frame.classList.add(cx.id);
		cx.root.appendChild(
			<div
				class={`container ${cx.id}`}
				class:active={use(this.activetab).map((t) => t === tab)}
			>
				{tab.frame.frame}
			</div>
		);
	});
	popTab.listen((tab) => {
		for (let el of cx.root.children) {
			if (el.children[0] == tab.frame.frame) {
				el.remove();
				break;
			}
		}
	});

	return <div class:unfocus={use(browser.unfocusframes)}></div>;
};
Shell.css = `
  :scope {
    flex: 1;
  }
  .unfocus {
    pointer-events: none;
  }
  .container {
    width: 100%;
    height: 100%;
    display: none;
  }
  .container.active {
    display: block;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
`;
