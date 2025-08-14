import { css, type Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconMore from "@ktibow/iconset-ion/more";
import { createMenu, setContextMenu } from "./Menu";
import { browser, scramjet } from "../main";
import { IconButton } from "./IconButton";
import { createDelegate, type Delegate } from "dreamland/core";
import type { Tab } from "../Tab";
import { UrlInput } from "./UrlInput";

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
	return (
		<div>
			<IconButton
				active={use(this.tab.canGoBack)}
				click={() => this.tab.back()}
				icon={iconBack}
			></IconButton>
			<IconButton
				active={use(this.tab.canGoForward)}
				click={() => this.tab.forward()}
				icon={iconForwards}
			></IconButton>
			<IconButton
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
		background: var(--aboutbrowser-omnibox-bg);
		display: flex;
		padding: 0 7px 0 7px;
		height: 2.5em;
		align-items: center;
		position: relative;
		gap: 0.2em;
	}
`;
