import type { Component } from "dreamland/core";
import { Icon } from "./ui/Icon";
import type { IconifyIcon } from "@iconify/types";
import iconBack from "@ktibow/iconset-material-symbols/arrow-back";
import iconForwards from "@ktibow/iconset-material-symbols/arrow-forward";
import iconRefresh from "@ktibow/iconset-material-symbols/refresh";
import iconExtension from "@ktibow/iconset-material-symbols/extension";
import iconSettings from "@ktibow/iconset-material-symbols/settings";
import iconShield from "@ktibow/iconset-material-symbols/shield";
import iconStar from "@ktibow/iconset-material-symbols/star";
import iconSearch from "@ktibow/iconset-material-symbols/search";
import { createMenu } from "./Menu";
import { client } from "./main";

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
		value: string;
	},
	{
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
				document.body.addEventListener("click", (e) => {
					this.active = false;
					e.stopPropagation();
				});
				this.input.focus();
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
						}
					}}
					on:input={(e: InputEvent) => {
						this.value = this.input.value;
						this.focusindex = 0;
					}}
				></input>

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
  input {
    background: none;
    border: none;
    outline: none;

    font-size: 1.00em;

    height: 100%;
    width: 100%;
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

export const IconButton: Component<{
	icon: IconifyIcon;
	click?: (e: MouseEvent) => void;
}> = function (cx) {
	return (
		<button on:click={(e) => this.click?.(e)}>
			<Icon icon={this.icon} />
		</button>
	);
};
IconButton.css = `
  :scope {
    padding: 0.4em;
    display: flex;
    outline: none;
    border: none;
    font-size: 1.25em;
    background: inerhit
    # background: var(--aboutbrowser-toolbar-bg);
    cursor: pointer;
  }
`;

export const Omnibox: Component<{
	value: string;
}> = function (cx) {
	return (
		<div>
			<IconButton icon={iconBack}></IconButton>
			<IconButton icon={iconForwards}></IconButton>
			<IconButton icon={iconRefresh}></IconButton>
			<Spacer></Spacer>
			<UrlInput value={use(this.value)}></UrlInput>
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
