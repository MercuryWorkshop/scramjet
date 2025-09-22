import { createState, css, type Component } from "dreamland/core";
import { Icon } from "./Icon";
import iconAdd from "@ktibow/iconset-ion/add";
import iconOpen from "@ktibow/iconset-ion/open-outline";
import iconLink from "@ktibow/iconset-ion/link-outline";
import iconBrush from "@ktibow/iconset-ion/brush-outline";
import iconTrash from "@ktibow/iconset-ion/trash-outline";
import { browser, type BookmarkEntry } from "../Browser";
import { createMenu, createMenuCustom, setContextMenu } from "./Menu";
import { BookmarkPopup } from "./BookmarkPopup";

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
			<button
				on:click={(e: MouseEvent) => {
					let b = createState<BookmarkEntry>({
						url: "",
						title: "New Bookmark",
					});
					createMenuCustom(
						{
							left: e.clientX,
							top: e.clientY,
						},
						<BookmarkPopup bookmark={b} new={false} />
					);
				}}
			>
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
						createMenu({ left: e.clientX, top: e.clientY }, [
							{
								label: "Open",
								icon: iconLink,
								action: () => browser.activetab.pushNavigate(new URL(b.url)),
							},
							{
								label: "Open in New Tab",
								icon: iconOpen,
								action: () => browser.newTab(new URL(b.url)),
							},
							{
								label: "Edit Bookmark",
								action: () => {
									// doesn't like having the menu open while opening another menu
									requestAnimationFrame(() => {
										createMenuCustom(
											{
												left: e.clientX,
												top: e.clientY,
											},
											<BookmarkPopup bookmark={b} new={false} />
										);
									});
								},
								icon: iconBrush,
							},
							{
								label: "Delete Bookmark",
								icon: iconTrash,
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
					<img src={use(b.favicon)}></img>
					<span>{use(b.title)}</span>
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
		display: flex;
		align-items: center;
		height: 100%;
		gap: 0.25em;

		padding-left: 0.25em;
		padding-right: 0.25em;
		border-radius: var(--radius);
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
