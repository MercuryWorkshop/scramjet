import { css, type Component } from "dreamland/core";
import { browser } from "../main";
import { forceScreenshot, popTab, pushTab } from "../Browser";
import type { Tab } from "../Tab";
import { toBlob } from "html-to-image";

export const Shell: Component = function (cx) {
	pushTab.listen((tab) => {
		// paint the iframes
		tab.frame.frame.classList.add(cx.id);
		tab.devtoolsFrame.frame.classList.add(cx.id);

		let mouseMoveListen = (e: MouseEvent) => {
			tab.devtoolsWidth = window.innerWidth - e.clientX;
		};
		cx.root.appendChild(
			<div
				class="container"
				data-tab={tab.id}
				id={"tab" + tab.id}
				class:active={use(browser.activetab).map((t) => t === tab)}
				class:showframe={use(tab.internalpage).map((t) => !t)}
			>
				<div
					class="mainframecontainer"
					class:unfocus={use(browser.unfocusframes)}
				>
					{use(tab.internalpage)}
					{tab.frame.frame}
				</div>
				<div
					class="devtools"
					class:active={use(tab.devtoolsOpen)}
					style={use`width: ${tab.devtoolsWidth}px`}
				>
					<div
						on:mousedown={(e: MouseEvent) => {
							browser.unfocusframes = true;
							document.body.style.cursor = "ew-resize";
							window.addEventListener("mousemove", mouseMoveListen);
							window.addEventListener("mouseup", () => {
								browser.unfocusframes = false;
								window.removeEventListener("mousemove", mouseMoveListen);
								document.body.style.cursor = "";
							});
						}}
						class="divider"
					></div>
					<div
						class="devtoolsframecontainer"
						class:unfocus={use(browser.unfocusframes)}
					>
						{tab.devtoolsFrame.frame}
					</div>
				</div>
			</div>
		);

		setInterval(() => forceScreenshot(tab), 1000);
	});
	popTab.listen((tab) => {
		const container = cx.root.querySelector(`[data-tab="${tab.id}"]`);
		if (!container) throw new Error(`No container found for tab ${tab.id}`);
		container.remove();
	});
	// forceScreenshot.listen(async (tab) => {
	// 	const container = cx.root.querySelector(
	// 		`[data-tab="${tab.id}"]`
	// 	) as HTMLElement;
	// 	if (!container) throw new Error(`No container found for tab ${tab.id}`);

	// 	// tab.screenshot = URL.createObjectURL(await toBlob(container));
	// });

	return <div></div>;
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
		position: relative;
		display: none;
		width: 20em;
	}
	.container .devtools.active {
		display: flex;
	}

	.mainframecontainer {
		display: flex;
		flex: 1;
	}

	.divider {
		position: absolute;
		top: 0;
		left: -5px;
		width: 5px;
		/* background: #ccc; */
		border-right: 1px solid #ccc;
		height: 100%;
		cursor: ew-resize;
	}

	iframe {
		flex: 1;
		height: 100%;
		width: 100%;
		border: none;
		display: none;
	}
	.showframe iframe {
		display: block;
	}
`;
