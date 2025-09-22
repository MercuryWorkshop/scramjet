import { css, type Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconDownload from "@ktibow/iconset-ion/download-outline";
import iconMore from "@ktibow/iconset-ion/more";
import iconExit from "@ktibow/iconset-ion/exit-outline";
import { createMenu, createMenuCustom } from "./Menu";
import { OmnibarButton } from "./OmnibarButton";
import { createDelegate } from "dreamland/core";
import type { Tab } from "../Tab";
import { UrlInput } from "./UrlInput";
import { browser } from "../Browser";
import { Icon } from "./Icon";

import iconNew from "@ktibow/iconset-ion/duplicate-outline";
import iconTime from "@ktibow/iconset-ion/time-outline";
import iconInfo from "@ktibow/iconset-ion/information-circle-outline";
import iconSettings from "@ktibow/iconset-ion/settings-outline";
import type { HistoryState } from "../History";
import { isPuter } from "../main";
import { DownloadsPopup } from "./DownloadsPopup";

export const animateDownloadFly = createDelegate<void>();
export const showDownloadsPopup = createDelegate<void>();

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

export const Omnibox: Component<{
	tab: Tab;
}> = function (cx) {
	const selectContent = createDelegate<void>();

	animateDownloadFly.listen(async () => {
		await new Promise((r) => setTimeout(r, 10));
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

	const historyMenu = (e: MouseEvent, states: HistoryState[]) => {
		if (states.length > 0) {
			createMenu(
				{ left: e.clientX, top: cx.root.clientTop + cx.root.clientHeight * 2 },
				[
					...states.map((s) => ({
						label: s.title || "New Tab",
						image: s.favicon || "/defaultfavicon.png",
						action: () => {
							let rel =
								browser.activetab.history.states.indexOf(s) -
								browser.activetab.history.index;
							browser.activetab.history.go(rel);
						},
					})),
					"-",
					{
						icon: iconTime,
						label: "Show Full History",
						action: () => {
							browser.newTab(new URL("puter://history"));
						},
					},
				]
			);
		}
		e.preventDefault();
		e.stopPropagation();
	};

	const downloadsButton = (
		<OmnibarButton
			click={() => {
				showDownloadsPopup();
			}}
			icon={iconDownload}
		></OmnibarButton>
	);
	showDownloadsPopup.listen(() => {
		const { right } = downloadsButton.getBoundingClientRect();
		createMenuCustom(
			{
				top: cx.root.clientTop + cx.root.clientHeight * 2,
				right,
			},
			<DownloadsPopup></DownloadsPopup>
		);
	});

	return (
		<div>
			<OmnibarButton
				tooltip="Go back one page (Alt+Left Arrow)"
				active={use(this.tab.canGoBack)}
				click={() => this.tab.back()}
				icon={iconBack}
				rightclick={(e: MouseEvent) =>
					historyMenu(
						e,
						browser.activetab.history.states
							.slice(0, browser.activetab.history.index)
							.reverse()
					)
				}
			></OmnibarButton>
			<OmnibarButton
				tooltip="Go forward one page (Alt+Right Arrow)"
				active={use(this.tab.canGoForward)}
				click={() => this.tab.forward()}
				icon={iconForwards}
				rightclick={(e: MouseEvent) =>
					historyMenu(
						e,
						browser.activetab.history.states.slice(
							browser.activetab.history.index + 1,
							browser.activetab.history.states.length
						)
					)
				}
			></OmnibarButton>
			<OmnibarButton
				tooltip="Refresh current page (Ctrl+R)"
				click={() => this.tab.reload()}
				icon={iconRefresh}
			></OmnibarButton>
			<Spacer></Spacer>
			<UrlInput
				selectContent={selectContent}
				tabUrl={use(this.tab.url)}
			></UrlInput>
			<Spacer></Spacer>
			<OmnibarButton active={false} icon={iconExtension}></OmnibarButton>
			{use(browser.sessionDownloadHistory)
				.map((s) => s.length > 0)
				.andThen(
					<div style="position: relative">
						{downloadsButton}

						<div class="downloadfly down">
							<Icon icon={iconDownload}></Icon>
						</div>
						<CircularProgress
							progress={use(browser.downloadProgress)}
						></CircularProgress>
					</div>
				)}

			<OmnibarButton
				tooltip="More Options"
				icon={iconMore}
				click={(e: MouseEvent) => {
					createMenu(
						{ left: e.x, top: cx.root.clientTop + cx.root.clientHeight * 2 },
						[
							{
								label: "New Tab",
								action: () => {
									browser.newTab(new URL("puter://newtab"), true);
								},
								icon: iconNew,
							},
							"-",
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
							"-",
							{
								label: "About",
								action: () => {
									browser.newTab(new URL("puter://version"));
								},
								icon: iconInfo,
							},
							{
								label: "Settings",
								action: () => {
									browser.newTab(new URL("puter://settings"));
								},
								icon: iconSettings,
							},
							...(isPuter
								? [
										{
											label: "Exit",
											action: () => {
												puter.exit();
											},
											icon: iconExit,
										},
									]
								: []),
						]
					);
					e.stopPropagation();
				}}
			></OmnibarButton>
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
