import { css, type Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconDownload from "@ktibow/iconset-ion/download-outline";
import iconMore from "@ktibow/iconset-ion/more";
import iconClose from "@ktibow/iconset-ion/close";
import iconOpen from "@ktibow/iconset-ion/open-outline";
import {
	closeMenu,
	createMenu,
	createMenuCustom,
	setContextMenu,
} from "./Menu";
import { IconButton } from "./IconButton";
import { createDelegate } from "dreamland/core";
import type { Tab } from "../Tab";
import { UrlInput } from "./UrlInput";
import { browser } from "../Browser";
import { Icon } from "./Icon";

import iconNew from "@ktibow/iconset-ion/duplicate-outline";
import iconTime from "@ktibow/iconset-ion/time-outline";
import iconInfo from "@ktibow/iconset-ion/information-circle-outline";
import iconSettings from "@ktibow/iconset-ion/settings-outline";
import { formatBytes } from "../pages/DownloadsPage";

export const animateDownloadFly = createDelegate<void>();

export const Spacer: Component = function (cx) {
	return <div></div>;
};
Spacer.style = css`
	:scope {
		width: 2em;
	}
`;

export const CircularProgress: Component<{
	progress: number;
	size?: string;
	strokeWidth?: string;
	color?: string;
}> = function (cx) {
	const radius = 100;
	const circumference = 2 * Math.PI * radius;

	use(this.progress).listen((p) => {
		if (p == 0) {
			cx.root.classList.remove("visible");
		} else {
			cx.root.classList.add("visible");

			cx.root
				.querySelector("circle.moving")!
				.setAttribute("stroke-dashoffset", circumference * (1 - p) + "px");
		}
	});

	return (
		<svg
			width="200"
			height="200"
			viewBox="0 0 200 200"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			style="transform:rotate(-90deg)"
		>
			<circle
				r="90"
				cx="100"
				cy="100"
				class="inactive"
				stroke-width="16px"
				stroke-linecap="round"
				stroke-dashoffset="0px"
				fill="transparent"
				stroke-dasharray="565.48px"
			></circle>
			<circle
				r="90"
				cx="100"
				cy="100"
				class="moving"
				stroke-width="16px"
				stroke-linecap="round"
				stroke-dashoffset="118.692px"
				fill="transparent"
				stroke-dasharray="565.48px"
			></circle>
		</svg>
	);
};
CircularProgress.style = css`
	:scope {
		pointer-events: none;
		position: absolute;
		top: 2px;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.2s ease;
		transform: rotate(-90deg);
	}
	:scope.visible {
		opacity: 1;
	}
	circle {
		fill: transparent;
		stroke: var(--accent);
		/*transition: stroke-dashoffset 0.2s ease;*/
	}
	circle.inactive {
		stroke: var(--bg20);
	}
`;

const DownloadsPopup: Component<{}> = function (cx) {
	return (
		<div>
			<div class="title">
				<span>Recent Downloads</span>
				<div class="iconcontainer">
					<button
						on:click={() => {
							closeMenu();
						}}
					>
						<Icon icon={iconClose}></Icon>
					</button>
				</div>
			</div>
			<div class="entries">
				{use(browser.globalDownloadHistory).mapEach((b) => (
					<div class="entry">
						<div class="iconcontainer">
							<img src="/defaultfavicon.png"></img>
						</div>
						<div class="contents">
							<span>{b.filename}</span>
							<span class="data">{formatBytes(b.size)}</span>
						</div>
					</div>
				))}
			</div>
			<div
				class="footer"
				on:click={() => {
					browser.newTab(new URL("puter://downloads"));
					closeMenu();
				}}
			>
				<span>Full Download History</span>
				<div class="iconcontainer">
					<Icon icon={iconOpen}></Icon>
				</div>
			</div>
		</div>
	);
};
DownloadsPopup.style = css`
	:scope {
		width: 20em;
		display: flex;
		flex-direction: column;
	}

	.title {
		padding: 1em;
		display: flex;
		border-bottom: 1px solid var(--fg4);
	}
	.title p {
		font-size: 1.25em;
	}
	.title button {
		display: flex;
		align-items: center;
		font-size: 1em;
		position: relative;
	}
	.title button:hover::before {
		content: "";
		z-index: -1;
		position: absolute;
		width: 150%;
		height: 150%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg20);
		border-radius: 50%;
	}

	.entries {
		max-height: 30em;
		display: flex;
		flex-direction: column;
		overflow-y: scroll;
		overflow-x: hidden;
	}

	.entry {
		padding: 1em;
		display: flex;
		gap: 1em;
		font-size: 0.9em;
	}
	.entry:hover {
		background: var(--bg20);
	}
	.contents {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}
	.contents .data {
		color: var(--fg2);
	}
	.footer {
		border-top: 1px solid var(--fg4);
		padding: 1em;
		cursor: pointer;
		display: flex;
		align-items: center;
	}
	.footer:hover {
		background: var(--bg20);
	}

	.iconcontainer {
		flex: 1;
		display: flex;
		justify-content: right;
	}
`;
export function showDownloadsPopup() {
	createMenuCustom(
		window.innerWidth - 350,
		80,
		<DownloadsPopup></DownloadsPopup>
	);
}

export const Omnibox: Component<{
	tab: Tab;
}> = function (cx) {
	const selectContent = createDelegate<void>();
	cx.mount = () => {
		setContextMenu(cx.root, [
			{
				label: "Select All",
				action: () => {
					selectContent();
				},
			},
		]);
	};

	animateDownloadFly.listen(() => {
		let fly: HTMLElement = cx.root.querySelector(".downloadfly")!;
		fly.addEventListener(
			"transitionend",
			() => {
				fly.style.opacity = "0";
				fly.classList.add("down");
			},
			{ once: true }
		);
		fly.style.opacity = "1";
		fly.classList.remove("down");
	});

	const historyMenu = (e: MouseEvent) => {
		if (browser.activetab.history.states.length > 1) {
			createMenu(
				e.clientX,
				e.clientY,
				browser.activetab.history.states.map((s) => ({
					label: s.title || "New Tab",
					action: () => {
						let rel =
							browser.activetab.history.states.indexOf(s) -
							browser.activetab.history.index;
						browser.activetab.history.go(rel);
					},
				}))
			);
		}
		e.preventDefault();
		e.stopPropagation();
	};

	return (
		<div>
			<IconButton
				tooltip="Go back one page (Alt+Left Arrow)"
				active={use(this.tab.canGoBack)}
				click={() => this.tab.back()}
				icon={iconBack}
				rightclick={historyMenu}
			></IconButton>
			<IconButton
				tooltip="Go forward one page (Alt+Right Arrow)"
				active={use(this.tab.canGoForward)}
				click={() => this.tab.forward()}
				icon={iconForwards}
				rightclick={historyMenu}
			></IconButton>
			<IconButton
				tooltip="Refresh current page (Ctrl+R)"
				click={() => this.tab.reload()}
				icon={iconRefresh}
			></IconButton>
			<Spacer></Spacer>
			<UrlInput
				selectContent={selectContent}
				tabUrl={use(this.tab.url)}
			></UrlInput>
			<Spacer></Spacer>
			<IconButton active={false} icon={iconExtension}></IconButton>
			<div style="position: relative">
				<IconButton
					click={() => {
						showDownloadsPopup();
					}}
					icon={iconDownload}
				></IconButton>
				<div class="downloadfly down">
					<Icon icon={iconDownload}></Icon>
				</div>
				<CircularProgress
					progress={use(browser.downloadProgress)}
				></CircularProgress>
			</div>
			<IconButton
				tooltip="More Options"
				icon={iconMore}
				click={(e: MouseEvent) => {
					createMenu(e.x, cx.root.clientTop + cx.root.clientHeight * 2, [
						{
							label: "New Tab",
							action: () => {
								browser.newTab(new URL("puter://newtab"), true);
							},
							icon: iconNew,
						},
						{
							label: "History",
							action: () => {
								browser.newTab(new URL("puter://history"));
							},
							icon: iconTime,
						},
						{
							label: "Downloads",
							action: () => {
								browser.newTab(new URL("puter://downloads"));
							},
							icon: iconDownload,
						},
						{
							label: "Settings",
							action: () => {
								browser.newTab(new URL("puter://settings"));
							},
							icon: iconSettings,
						},
						{
							label: "About",
							action: () => {
								browser.newTab(new URL("puter://version"));
							},
							icon: iconInfo,
						},
					]);
					e.stopPropagation();
				}}
			></IconButton>
		</div>
	);
};
Omnibox.style = css`
	:scope {
		z-index: 1;
		background: var(--bg01);
		display: flex;
		padding: 0 7px 0 7px;
		height: 2.5em;
		align-items: center;
		position: relative;
		gap: 0.2em;
	}

	.downloadfly {
		position: absolute;
		top: 0;
		box-sizing: border-box;
		aspect-ratio: 1/1;
		align-items: center;
		justify-content: center;
		width: 100%;

		display: flex;
		outline: none;
		border: none;
		font-size: 1.25em;
		background: none;
		color: var(--fg);
		border-radius: 0.2em;

		transition: top 0.5s ease;
	}
	.downloadfly.down {
		top: 100vh;
	}
	.downloadfly::before {
		position: absolute;
		content: "";
		z-index: -1;
		height: 2em;
		width: 2em;
		border-radius: 50%;
		opacity: 0.5;
		background: var(--bg20);
	}
`;
