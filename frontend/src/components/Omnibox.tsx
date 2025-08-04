import { css, type Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconMore from "@ktibow/iconset-ion/more";
import iconShield from "@ktibow/iconset-ion/shield-outline";
import iconStar from "@ktibow/iconset-ion/star-outline";
import iconSearch from "@ktibow/iconset-ion/search";
import { createMenu, setContextMenu } from "./Menu";
import { browser, scramjet } from "../main";
import { IconButton } from "./IconButton";
import { createDelegate, type Delegate } from "dreamland/core";
import type { Tab } from "../Tab";

export function trimUrl(v: URL) {
	return (
		(v.protocol === "puter:" ? v.protocol : "") + v.host + v.pathname + v.search
	);
}

export const Spacer: Component = function (cx) {
	return <div></div>;
};
Spacer.style = css`
	:scope {
		width: 2em;
	}
`;

type OmniboxResult = {
	kind: "search" | "history" | "bookmark" | "direct";
	title?: string | null;
	url: URL;
	favicon?: string | null;
};

export const UrlInput: Component<
	{
		tabUrl: URL;
		selectContent: Delegate<void>;
	},
	{
		value: string;
		active: boolean;
		input: HTMLInputElement;

		focusindex: number;

		overflowItems: OmniboxResult[];
	}
> = function (cx) {
	this.focusindex = 0;
	this.overflowItems = [];
	this.value = "";
	const fetchSuggestions = async () => {
		let search = this.input.value;

		this.overflowItems = [];

		for (const entry of browser.globalhistory) {
			if (!entry.url.href.includes(search) && !entry.title?.includes(search))
				continue;
			if (this.overflowItems.some((i) => i.url.href === entry.url.href))
				continue;

			this.overflowItems.push({
				kind: "history",
				title: entry.title,
				url: entry.url,
				favicon: entry.favicon,
			});
		}
		this.overflowItems = this.overflowItems.slice(0, 5);

		if (URL.canParse(search)) {
			this.overflowItems = [
				{
					kind: "direct",
					url: new URL(search),
				},
				...this.overflowItems,
			];
			return;
		}

		let resp = await fetch(
			scramjet.encodeUrl(
				`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(search)}`
			)
		);
		let json = await resp.json();
		for (const item of json[1].slice(0, 5)) {
			// it's gonna be stuff like "http //fortnite.com/2fa ps5"
			// these results are generally useless
			if (item.startsWith("http")) continue;

			this.overflowItems.push({
				kind: "search",
				title: item,
				url: new URL(
					`https://www.google.com/search?q=${encodeURIComponent(item)}`
				),
				favicon: scramjet.encodeUrl("https://www.google.com/favicon.ico"),
			});
		}

		this.overflowItems = this.overflowItems;
	};
	let currentTimeout: number | null = null;
	let ratelimiting = false;
	let interval = 100;
	use(this.value).listen(() => {
		if (!this.value) {
			this.overflowItems = [];
			return;
		}
		if (ratelimiting) {
			if (currentTimeout) return;
			currentTimeout = setTimeout(() => {
				ratelimiting = false;
				fetchSuggestions();
				currentTimeout = null;
			}, interval);
		} else {
			ratelimiting = true;
			fetchSuggestions();
		}
	});
	const activate = () => {
		this.active = true;
		browser.unfocusframes = true;
		document.body.addEventListener("click", (e) => {
			this.active = false;
			browser.unfocusframes = false;
			e.stopPropagation();
		});
		this.value = this.tabUrl.href;
		this.input.focus();
		this.input.select();
	};

	this.selectContent.listen(() => {
		this.active = true;
		activate();

		this.input.select();
	});

	return (
		<div
			on:click={(e: MouseEvent) => {
				if (this.active) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				activate();
				e.stopPropagation();
			}}
		>
			<div class="inactivebar"></div>
			<div class="overflow" class:active={use(this.active)}>
				<div class="spacer"></div>
				{use(this.overflowItems).mapEach((item) => (
					<div
						class="overflowitem"
						on:click={() => {
							this.active = false;
							this.input.blur();

							browser.activetab.pushNavigate(item.url);
						}}
						class:focused={use(this.focusindex).map(
							(i) => i - 1 === this.overflowItems.indexOf(item)
						)}
					>
						<img
							class="favicon"
							src={item.favicon || "/vite.svg"}
							alt="favicon"
						/>
						{(item.title && <span class="description">{item.title} - </span>) ||
							""}
						<span class="url">{trimUrl(item.url)}</span>
					</div>
				))}
			</div>
			<div class="realbar">
				<IconButton icon={iconShield}></IconButton>
				{use(this.active).andThen(
					<input
						this={use(this.input).bind()}
						value={use(this.value).bind()}
						on:keydown={(e: KeyboardEvent) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								this.focusindex++;
								if (this.focusindex > this.overflowItems.length) {
									this.focusindex = 0;
								}
							}
							if (e.key === "ArrowUp") {
								e.preventDefault();
								this.focusindex--;
								if (this.focusindex < 0) {
									this.focusindex = this.overflowItems.length;
								}
							}
							if (e.key === "Enter") {
								e.preventDefault();
								if (this.focusindex > 0) {
									browser.activetab.pushNavigate(
										this.overflowItems[this.focusindex - 1].url
									);
									this.active = false;
									this.input.blur();
								} else {
									browser.searchNavigate(this.value);
								}
							}
						}}
						on:input={(e: InputEvent) => {
							this.value = this.input.value;
							this.focusindex = 0;
						}}
					></input>
				)}
				{use(this.active)
					.map((a) => !a)
					.andThen(
						<span class="inactiveurl">{use(this.tabUrl).map(trimUrl)}</span>
					)}

				<IconButton icon={iconStar}></IconButton>
			</div>
		</div>
	);
};
UrlInput.style = css`
	:scope {
		position: relative;
		flex: 1;
		display: flex;
		height: 100%;
	}

	.favicon {
		width: 16px;
		height: 16px;
	}

	.overflow {
		position: absolute;
		display: none;
		background: var(--aboutbrowser-omnibox-bg);
		width: 100%;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.overflow .spacer {
		display: block;
		height: 2.5em;
	}
	.overflowitem {
		display: flex;
		align-items: center;
		height: 2.5em;
		cursor: pointer;
		gap: 0.5em;
		padding-left: 0.5em;
		white-space: nowrap;
	}
	.overflowitem .url,
	.overflowitem .description {
		text-overflow: ellipsis;
		text-wrap: nowrap;
		word-wrap: nowrap;
		overflow: hidden;
	}

	.overflowitem .url {
		color: grey;
	}
	.overflowitem.focused {
		background: blue;
	}

	.overflow.active {
		display: block;
	}
	.inactivebar {
		background: white;
		width: 100%;
		border: none;
		outline: none;
		border-radius: 4px;
		margin: 0.25em;
	}
	input,
	.inactiveurl {
		background: none;
		border: none;
		outline: none;

		font-size: 1em;

		height: 100%;
		width: 100%;
	}
	.inactiveurl {
		display: flex;
		align-items: center;
	}

	.realbar {
		position: absolute;
		width: 100%;
		height: 100%;
		display: flex;
		z-index: 1;
		align-items: center;
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
			<IconButton icon={iconExtension}></IconButton>
			<IconButton
				icon={iconMore}
				click={(e: MouseEvent) => {
					createMenu(e.x, cx.root.clientTop + cx.root.clientHeight * 2, [
						{
							label: "New Tab",
							action: () => {
								browser.newTab();
							},
						},
						{
							label: "History",
							action: () => {
								let t = browser.newTab(new URL("puter://history"));
							},
						},
						{
							label: "Settings",
							action: () => {
								let t = browser.newTab();
								t.replaceNavigate(new URL("puter://settings"));
							},
						},
						{
							label: "About",
							action: () => {
								let t = browser.newTab();
								t.replaceNavigate(new URL("puter://version"));
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
		padding: 0px 7px 0px 7px;
		height: 2.5em;
		align-items: center;
		position: relative;
	}
`;
