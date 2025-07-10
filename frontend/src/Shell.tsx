import type { Component } from "dreamland/core";
import type { Tab } from "./Tab";

export const Shell: Component<
	{
		tabs: Tab[];
		activeTab: Tab;
	},
	{},
	{
		pushFrame: (frame: ScramjetFrame) => void;
	}
> = function (cx) {
	this.pushFrame = (frame) => {
		cx.root.appendChild(
			<div
				class="container"
				class:active={use(this.activeTab).map(
					(t) => t && t.$.state.frame === frame
				)}
			>
				{frame.frame}
			</div>
		);
	};

	return <div></div>;
};
Shell.css = `
  iframe {

  }
`;
