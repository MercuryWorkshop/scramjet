import { css, type Component } from "dreamland/core";
import { browser } from "../main";
import { forceScreenshot, popTab, pushTab } from "../browser";
import type { Tab } from "../Tab";
import html2canvas from "html2canvas";

export const Shell: Component<{
	tabs: Tab[];
	activetab: Tab;
}> = function (cx) {
	pushTab.listen((tab) => {
		tab.frame.frame.classList.add(cx.id);
		let devtoolsFrame: HTMLIFrameElement = <iframe class={cx.id}></iframe>;
		cx.root.appendChild(
			<div
				class={`container ${cx.id}`}
				data-tab={tab.id}
				class:active={use(this.activetab).map((t) => t === tab)}
				class:showframe={use(tab.internalpage).map((t) => !t)}
			>
				{use(tab.internalpage)}
				{tab.frame.frame}
				<div class={`devtools ${cx.id}`}>{devtoolsFrame}</div>
			</div>
		);
		tab.devtoolsFrame = devtoolsFrame;
	});
	popTab.listen((tab) => {
		const container = cx.root.querySelector(`[data-tab="${tab.id}"]`);
		if (!container) throw new Error(`No container found for tab ${tab.id}`);
		container.remove();
	});
	forceScreenshot.listen(async (tab) => {
		const container = cx.root.querySelector(
			`[data-tab="${tab.id}"]`
		) as HTMLElement;
		if (!container) throw new Error(`No container found for tab ${tab.id}`);

		const canvas = await html2canvas(
			container.children[0].contentDocument.body
		);
		tab.screenshot = canvas.toDataURL();
	});

	return <div class:unfocus={use(browser.unfocusframes)}></div>;
};
Shell.style = css`
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
		display: flex;
	}
	.container .devtools {
		display: block;
		width: 20em;
	}
	iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: none;
	}
	.showframe iframe {
		display: block;
	}
`;
