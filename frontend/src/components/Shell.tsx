import { css, type Component } from "dreamland/core";
import { browser } from "../Browser";
import { forceScreenshot, popTab, pushTab } from "../Browser";
import { takeScreenshotGDM, takeScreenshotSvg } from "../screenshot";

export const Shell: Component = function (cx) {
	pushTab.listen((tab) => {
		// paint the iframes
		tab.frame.frame.classList.add(cx.id!);
		tab.devtoolsFrame.frame.classList.add(cx.id!);

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

		let blob = await takeScreenshotGDM(container);
		if (blob) tab.screenshot = URL.createObjectURL(blob);
		else {
			// tab.screenshot = await takeScreenshotSvg(container);
		}
	});

	return <div></div>;
};

Shell.style = css`
	:scope {
		flex: 1;
		overflow: hidden;
		width: 100%;
		position: relative;
	}
	.unfocus {
		pointer-events: none;
	}
	.container {
		position: absolute;
		width: 100%;
		height: 100%;
		display: flex;
		top: 0;
		left: 0;
		z-index: -1;
		/*display: none;*/

		/*https://screen-share.github.io/element-capture/#elements-eligible-for-restriction*/
		isolation: isolate;
		transform-style: flat;
	}
	.container.active {
		z-index: 1;
	}
	.container .devtools {
		position: relative;
		display: none;
		width: 20em;
	}
	.container .devtools.active {
		display: flex;
	}

	.devtoolsframecontainer {
		width: 100%;
	}

	.mainframecontainer {
		display: flex;
		width: 100%;
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
