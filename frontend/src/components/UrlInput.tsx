import {
	createDelegate,
	css,
	type Component,
	type Delegate,
} from "dreamland/core";
import iconOptions from "@ktibow/iconset-ion/options-outline";
import iconStar from "@ktibow/iconset-ion/star-outline";
import iconStarFilled from "@ktibow/iconset-ion/star";
import iconSearch from "@ktibow/iconset-ion/search";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconTrash from "@ktibow/iconset-ion/trash-outline";
import { Icon } from "./Icon";
import { scramjet } from "../main";
import { IconButton } from "./IconButton";
import { parse } from "tldts";
import { createMenu } from "./Menu";
import { browser } from "../Browser";

export const focusOmnibox = createDelegate<void>();
export function trimUrl(v: URL) {
	return (
		(v.protocol === "puter:" ? v.protocol : "") +
		v.host +
		(v.search ? v.pathname : v.pathname.replace(/\/$/, "")) +
		v.search
	);
}

// subdomain, domain+tld+port, path+search+query
function splitUrl(url: URL): [string, string, string] {
	let last = url.pathname + url.search + url.hash;
	if (last == "/") last = "";

	let results = parse(url.href);
	let domain = results.domain;
	if (domain && url.port) {
		domain += ":" + url.port;
	}
	let subdomain = results.subdomain;
	if (subdomain) {
		subdomain += ".";
	}

	return [subdomain || "", domain || "", last];
}

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
		justselected: boolean;
		subtleinput: boolean;

		input: HTMLInputElement;

		focusindex: number;

		overflowItems: OmniboxResult[];
	}
> = function () {
	this.focusindex = 0;
	this.overflowItems = [];
	this.value = "";

	focusOmnibox.listen(() => {
		setTimeout(() => {
			activate();
			this.subtleinput = true;
		}, 10);
	});

	let lastgooglesuggestions: OmniboxResult[] = [];
	const fetchSuggestions = async () => {
		let search = this.input.value;

		this.overflowItems = lastgooglesuggestions;

		let googlesuggestions: OmniboxResult[] = [];

		for (const entry of browser.globalhistory) {
			if (!entry.url.href.includes(search) && !entry.title?.includes(search))
				continue;
			if (googlesuggestions.some((i) => i.url.href === entry.url.href))
				continue;

			googlesuggestions.push({
				kind: "history",
				title: entry.title,
				url: entry.url,
				favicon: entry.favicon,
			});
		}
		lastgooglesuggestions = googlesuggestions.slice(0, 5);
		this.overflowItems = googlesuggestions.slice(0, 5);

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
		this.subtleinput = false;
		this.active = true;
		browser.unfocusframes = true;
		const ev = (e: MouseEvent) => {
			this.active = false;
			browser.unfocusframes = false;
			e.preventDefault();

			document.body.removeEventListener("click", ev);
			document.body.removeEventListener("auxclick", ev);
		};
		document.body.addEventListener("click", ev);
		document.body.addEventListener("auxclick", ev);

		if (this.tabUrl.href == "puter://newtab") {
			this.value = "";
		} else {
			this.value = trimUrl(this.tabUrl);
		}
		this.input.focus();
		this.input.select();
		this.justselected = true;

		this.input.scrollLeft = 0;
	};

	const doSearch = () => {
		if (this.focusindex > 0) {
			browser.activetab.pushNavigate(
				this.overflowItems[this.focusindex - 1].url
			);
		} else {
			browser.searchNavigate(this.value);
		}

		this.active = false;
		this.input.blur();
	};

	this.selectContent.listen(() => {
		activate();
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
			<div
				class="overflow"
				class:active={use(this.active, this.subtleinput).map(
					([a, s]) => a && !s
				)}
			>
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
						{item.kind === "search" ? (
							<Icon icon={iconSearch}></Icon>
						) : (
							<img
								class="favicon"
								src={item.favicon || "/vite.svg"}
								alt="favicon"
							/>
						)}
						{(item.title && (
							<span class="description">
								{item.title.startsWith(this.input.value) ? (
									<>
										<span style="font-weight: normal; opacity: 0.7;">
											{item.title.substring(0, this.input.value.length)}
										</span>
										<span>{item.title.substring(this.input.value.length)}</span>
									</>
								) : (
									<span style="font-weight: normal; opacity: 0.7;">
										{item.title}
									</span>
								)}
								<span>{" - "}</span>
							</span>
						)) ||
							""}
						<span class="url">{trimUrl(item.url)}</span>
					</div>
				))}
			</div>
			<div class="realbar">
				<div class="lefticon">
					{use(this.active, this.focusindex, this.overflowItems).map(() =>
						this.active ? (
							this.focusindex > 0 && this.overflowItems.length > 0 ? (
								<img
									src={
										this.overflowItems[this.focusindex - 1].favicon ||
										"/vite.svg"
									}
								></img>
							) : (
								<Icon icon={iconSearch}></Icon>
							)
						) : (
							<button
								class="optionsbutton"
								on:click={(e: MouseEvent) => {
									createMenu(e.clientX, e.clientY, [
										{ label: "Clear Site Data", icon: iconTrash },
									]);
									e.preventDefault();
									e.stopPropagation();
								}}
							>
								<Icon icon={iconOptions}></Icon>
							</button>
						)
					)}
				</div>
				{use(this.active).andThen(
					<input
						spellcheck="false"
						this={use(this.input)}
						value={use(this.value)}
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

								doSearch();
							}
						}}
						// keyup, we want this to happen after the input has been processed (so the user can delete the whole thing)
						on:keyup={(e: KeyboardEvent) => {
							if (!this.justselected) return;

							// if the user didn't modify anything
							if (this.input.value == trimUrl(this.tabUrl)) {
								// insert the untrimmed version
								this.input.value = this.tabUrl.href;
							}

							if (e.key == "ArrowLeft") {
								// move the cursor to the start
								if (this.tabUrl.protocol == "puter:") {
									this.input.setSelectionRange(0, 0);
								} else {
									let schemelen = this.tabUrl.protocol.length + 2;
									this.input.setSelectionRange(schemelen, schemelen);
								}
							}

							this.justselected = false;
						}}
						on:input={() => {
							this.value = this.input.value;
							this.focusindex = 0;
							this.subtleinput = false;
						}}
					></input>
				)}
				{use(this.active, this.tabUrl)
					.map(([active, url]) => !active && url.href != "puter://newtab")
					.andThen(
						<span class="inactiveurl">
							<span class="subdomain">
								{use(this.tabUrl).map((t) => splitUrl(t)[0])}
							</span>
							<span class="domain">
								{use(this.tabUrl).map((t) => splitUrl(t)[1])}
							</span>
							<span class="rest">
								{use(this.tabUrl).map((t) => splitUrl(t)[2])}
							</span>
						</span>
					)}
				{use(this.active, this.tabUrl)
					.map(([active, url]) => !active && url.href == "puter://newtab")
					.andThen(
						<span class="placeholder">Search with Google or enter address</span>
					)}

				{use(this.active)
					.map((a) => !a)
					.andThen(
						<IconButton
							click={(e) => {
								e.stopPropagation();
								e.preventDefault();
								let bookmark = browser.bookmarks.find(
									(b) => b.url == this.tabUrl.href
								);
								if (bookmark) {
									browser.bookmarks = browser.bookmarks.filter(
										(b) => b.url !== this.tabUrl.href
									);
								} else {
									browser.bookmarks = [
										{
											url: browser.activetab.url.href,
											favicon: browser.activetab.icon,
											title:
												browser.activetab.title ||
												browser.activetab.url.hostname,
										},
										...browser.bookmarks,
									];
								}
							}}
							icon={use(browser.bookmarks, this.tabUrl).map(() =>
								browser.bookmarks.some((b) => b.url == this.tabUrl.href)
									? iconStarFilled
									: iconStar
							)}
						></IconButton>
					)}
				{use(this.active).andThen(
					<IconButton
						click={(e: MouseEvent) => {
							doSearch();
							e.stopPropagation();
							e.preventDefault();
						}}
						icon={iconForwards}
					></IconButton>
				)}
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

	.lefticon {
		font-size: 1.25em;
		color: var(--fg);
		display: flex;
		margin: 0.25em;
		align-self: stretch;
		align-items: center;
	}
	.lefticon img {
		width: 20px;
		height: 20px;
	}

	.favicon {
		width: 16px;
		height: 16px;
	}

	.optionsbutton {
		width: 100%;
		/*height: 100%;*/
		cursor: pointer;
		padding: 0;
		margin: 0;
		background: none;
		outline: none;
		border: none;
		color: var(--fg);
		font-size: 1em;
		padding: 0.1em;
		border-radius: 0.2em;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg01);
	}
	.optionsbutton:hover {
		background: var(--bg02);
	}

	.overflow {
		position: absolute;
		display: none;
		background: var(--bg);
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

		color: var(--fg);
	}
	.overflowitem .url,
	.overflowitem .description {
		text-overflow: ellipsis;
		text-wrap: nowrap;
		word-wrap: nowrap;
		overflow: hidden;
	}

	.overflowitem .url {
		color: var(--fg20);
	}
	.overflowitem.focused {
		background: var(--bg04);
	}

	.overflow.active {
		display: block;
	}
	.inactivebar {
		background: var(--bg);
		width: 100%;
		border: none;
		outline: none;
		border-radius: 4px;
		margin: 0.25em;
	}
	/*:scope:hover .inactivebar {
		background: var(--bg20);
	}*/
	input,
	.inactiveurl,
	.placeholder {
		background: none;
		border: none;
		outline: none;

		font-size: 1em;

		height: 100%;
		width: 100%;

		text-wrap: nowrap;
		overflow: hidden;
		font-family: var(--font);

		color: var(--fg);
	}
	.inactiveurl {
		display: flex;
		align-items: center;
		color: var(--fg);
	}
	.inactiveurl .subdomain,
	.inactiveurl .rest {
		opacity: 0.7;
		color: var(--fg2);
	}

	.placeholder {
		color: var(--fg4);
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

		padding-left: 0.25em;
		padding-right: 0.25em;
	}
`;
