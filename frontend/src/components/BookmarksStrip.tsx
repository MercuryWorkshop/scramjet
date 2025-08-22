import { css, type Component } from "dreamland/core";
import { Icon } from "./Icon";
import iconAdd from "@ktibow/iconset-ion/add";
import { browser } from "../Browser";
import { createMenu, setContextMenu } from "./Menu";

export const BookmarksStrip: Component = function (cx) {
	cx.mount = () => {
		setContextMenu(cx.root, [
			{
				label: "Add Bookmark",
				icon: iconAdd,
				action: () => {},
			},
			{
				label: "Pin Bookmarks Strip",
				checkbox: use(browser.settings.bookmarksPinned),
			},
		]);
	};

	return (
		<div>
			<button on:click={() => {}}>
				<Icon icon={iconAdd}></Icon>
				<span>create bookmark</span>
			</button>
			{use(browser.bookmarks).mapEach((b) => (
				<button
					on:auxclick={(e: MouseEvent) => {
						if (e.button != 1) return;
						browser.newTab(new URL(b.url));
					}}
					on:contextmenu={(e: MouseEvent) => {
						createMenu(e.clientX, e.clientY, [
							{
								label: "Open",
								action: () => browser.activetab.pushNavigate(new URL(b.url)),
							},
							{
								label: "Open in New Tab",
								action: () => browser.newTab(new URL(b.url)),
							},
							{
								label: "Edit Bookmark",
							},
							{
								label: "Delete Bookmark",
								action: () => {
									browser.bookmarks = browser.bookmarks.filter((br) => br != b);
								},
							},
						]);
						e.preventDefault();
						e.stopPropagation();
					}}
					on:click={() => {
						browser.activetab.pushNavigate(new URL(b.url));
					}}
				>
					<img src={b.favicon}></img>
					<span>{b.title}</span>
				</button>
			))}
		</div>
	);
};
BookmarksStrip.style = css`
	:scope {
		padding: 0.25em;
		height: 2em;
		display: flex;
		gap: 0.5em;
		background: var(--bg01);
		color: var(--fg);
	}

	button {
		padding: 0;
		border: 0;
		display: flex;
		align-items: center;
		height: 100%;
		gap: 0.25em;

		padding-left: 0.25em;
		padding-right: 0.25em;
		background: none;
		border-radius: var(--radius);
		cursor: pointer;

		color: var(--fg);
		font-family: var(--font);
	}
	button:hover {
		background: var(--bg20);
	}
	button span {
		white-space: nowrap;
	}

	button img {
		width: 16px;
		height: 16px;
	}
`;
