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
import { browser, client } from "../main";
import { IconButton } from "./IconButton";
import { createDelegate, type Delegate } from "dreamland/core";

export const Spacer: Component = function (cx) {
	return <div></div>;
};
Spacer.style = css`
	:scope {
		width: 2em;
	}
`;

export const UrlInput: Component<
	{
		tabUrl: URL;
		navigate: (url: string) => void;
		selectContent: Delegate<void>;
	},
	{
		value: string;
		active: boolean;
		input: HTMLInputElement;

		focusindex: number;

		overflowItems: string[];
	}
> = function (cx) {
	this.focusindex = 0;
	this.overflowItems = [];
	this.value = "";
	const fetchSuggestions = async () => {
		let resp = await client.fetch(
			`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(this.input.value)}`
		);
		let json = await resp.json();
		console.log(json);
		this.overflowItems = json[1].slice(0, 5);
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
			// TODO: why is it using the node types here
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
							this.value = item;
							this.active = false;
							this.input.blur();

							this.navigate(this.value);
						}}
						class:focused={use(this.focusindex).map(
							(i) => i - 1 === this.overflowItems.indexOf(item)
						)}
					>
						<IconButton icon={iconSearch}></IconButton>
						<span>{item}</span>
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
									this.value = this.overflowItems[this.focusindex - 1];
									this.navigate(this.value);
									this.active = false;
									this.input.blur();
								} else {
									this.navigate(this.value);
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
						<span class="inactiveurl">
							{use(this.tabUrl).map(
								(v) =>
									(v.protocol === "puter:" ? v.protocol : "") +
									v.host +
									v.pathname +
									v.search
							)}
						</span>
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
	tabUrl: URL;
	navigate: (url: string) => void;
	goBack: () => void;
	goForwards: () => void;
	refresh: () => void;
	canGoBack: boolean;
	canGoForwards: boolean;
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
				active={use(this.canGoBack)}
				click={this.goBack}
				icon={iconBack}
			></IconButton>
			<IconButton
				active={use(this.canGoForwards)}
				click={this.goForwards}
				icon={iconForwards}
			></IconButton>
			<IconButton click={this.refresh} icon={iconRefresh}></IconButton>
			<Spacer></Spacer>
			<UrlInput
				selectContent={selectContent}
				tabUrl={use(this.tabUrl)}
				navigate={this.navigate}
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
								let t = browser.newTab();
								t.replaceNavigate(new URL("puter://history"));
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
		background: var(--aboutbrowser-omnibox-bg);
		display: flex;
		padding: 0px 7px 0px 7px;
		height: 2.5em;
		align-items: center;
		position: relative;
	}
`;
