import type { Component } from "dreamland/core";
import iconBack from "@ktibow/iconset-ion/arrow-back";
import iconForwards from "@ktibow/iconset-ion/arrow-forward";
import iconRefresh from "@ktibow/iconset-ion/refresh";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconSettings from "@ktibow/iconset-ion/settings-outline";
import iconShield from "@ktibow/iconset-ion/shield-outline";
import iconStar from "@ktibow/iconset-ion/star-outline";
import iconSearch from "@ktibow/iconset-ion/search";
import { createMenu } from "./Menu";
import { browser, client } from "../main";
import { IconButton } from "./IconButton";

export const Spacer: Component = function (cx) {
	return <div></div>;
};
Spacer.css = `
  :scope {
    width: 2em;
  }
`;

export const UrlInput: Component<
	{
		tabUrl: string;
		navigate: (url: string) => void;
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
	this.overflowItems = ["test", "test2", "test3", "test4", "test5"];
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
	return (
		<div
			on:click={(e: MouseEvent) => {
				this.active = true;
				browser.unfocusframes = true;
				document.body.addEventListener("click", (e) => {
					this.active = false;
					browser.unfocusframes = false;
					e.stopPropagation();
				});
				this.value = this.tabUrl;
				this.input.focus();
				this.input.select();
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
								this.active = true;
								this.focusindex++;
								if (this.focusindex > this.overflowItems.length) {
									this.focusindex = 0;
								}
							}
							if (e.key === "ArrowUp") {
								e.preventDefault();
								this.active = true;
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
							{use(this.tabUrl).map((v) =>
								v && URL.canParse(v)
									? new URL(v).hostname +
										new URL(v).pathname +
										new URL(v).search
									: ""
							)}
						</span>
					)}

				<IconButton icon={iconStar}></IconButton>
			</div>
		</div>
	);
};
UrlInput.css = `
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
  input, .inactiveurl {
    background: none;
    border: none;
    outline: none;

    font-size: 1.00em;

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
	tabUrl: string;
	navigate: (url: string) => void;
	goBack: () => void;
	goForwards: () => void;
	refresh: () => void;
}> = function (cx) {
	return (
		<div>
			<IconButton click={this.goBack} icon={iconBack}></IconButton>
			<IconButton click={this.goForwards} icon={iconForwards}></IconButton>
			<IconButton click={this.refresh} icon={iconRefresh}></IconButton>
			<Spacer></Spacer>
			<UrlInput tabUrl={use(this.tabUrl)} navigate={this.navigate}></UrlInput>
			<Spacer></Spacer>
			<IconButton icon={iconExtension}></IconButton>
			<IconButton
				icon={iconSettings}
				click={(e: MouseEvent) => {
					createMenu(e.x, e.y, [
						{
							label: "Settings",
						},
					]);
					e.stopPropagation();
				}}
			></IconButton>
		</div>
	);
};
Omnibox.css = `
  :scope {
     	background: var(--aboutbrowser-omnibox-bg);
      display: flex;
      padding: 0px 7px 0px 7px;
      height: 2.5em;
      align-items: center;
      position: relative;
    }
`;
