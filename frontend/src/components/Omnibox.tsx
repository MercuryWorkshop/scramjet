import { css, type Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconMore from "@ktibow/iconset-ion/more";
import { createMenu, setContextMenu } from "./Menu";
import { IconButton } from "./IconButton";
import { createDelegate, type Delegate } from "dreamland/core";
import type { Tab } from "../Tab";
import { UrlInput } from "./UrlInput";
import { browser } from "../Browser";

export const Spacer: Component = function (cx) {
	return <div></div>;
};
Spacer.style = css`
	:scope {
		width: 2em;
	}
`;

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
						},
						{
							label: "History",
							action: () => {
								browser.newTab(new URL("puter://history"));
							},
						},
						{
							label: "Settings",
							action: () => {
								browser.newTab(new URL("puter://settings"));
							},
						},
						{
							label: "About",
							action: () => {
								browser.newTab(new URL("puter://version"));
							},
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
`;
