import type { Component } from "dreamland/core";
import type { Tab } from "./tabs";

export let pushTab: (tab: Tab) => void;
export let popTab: (tab: Tab) => void;

export const Shell: Component<{
	tabs: Tab[];
	activetab: Tab;
}> = function (cx) {
	pushTab = (tab) => {
		tab.frame.frame.classList.add(cx.id);
		cx.root.appendChild(
			<div
				class={`container ${cx.id}`}
				class:active={use(this.activetab).map((t) => t === tab)}
			>
				{tab.frame.frame}
			</div>
		);
	};
	popTab = (tab) => {
		for (let el of cx.root.children) {
			if (el.children[0] == tab.frame.frame) {
				el.remove();
				break;
			}
		}
	};

	return <div></div>;
};
Shell.css = `
  :scope {
    flex: 1;
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
