import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import { scramjet } from "../main";
import type { IconifyIcon } from "@iconify/types";
import { Icon } from "../components/Icon";

import iconSettings from "@ktibow/iconset-ion/settings-outline";
import iconSearch from "@ktibow/iconset-ion/search-outline";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";

export const SettingsPage: Component<
	{
		tab: Tab;
	},
	{
		selected: string;
	}
> = function () {
	this.selected = "general";

	const button = (id: string, icon: IconifyIcon, name: string) => {
		return (
			<div
				class="button"
				class:active={use(this.selected).map((s) => s === id)}
				on:click={() => {
					this.selected = id;
				}}
			>
				<Icon icon={icon} />
				<span>{name}</span>
			</div>
		);
	};

	const tabs = {
		general: (
			<div>
				<h2>General Settings</h2>

				<p>Theme</p>
				<input type="radio" id="dark" name="theme" value="dark" />
				<label for="dark">Dark</label>
				<br />
				<input type="radio" id="light" name="theme" value="light" />
				<label for="light">Light</label>
				<br />
			</div>
		),
		search: (
			<div>
				<h2>Search Settings</h2>
				<label for="search-engine">Search Engine:</label>
				<select id="search-engine">
					<option value="google">Google</option>
					<option value="bing">Bing</option>
					<option value="duckduckgo">DuckDuckGo</option>
					<option value="yahoo">Yahoo</option>
				</select>
			</div>
		),
		extensions: (
			<div>
				<h2>Extensions Settings</h2>
			</div>
		),
	};

	return (
		<div>
			<div class="sidebar">
				<h1>Settings</h1>
				{button("general", iconSettings, "General")}
				{button("search", iconSearch, "Search")}
				{button("extensions", iconExtension, "Extension")}
			</div>
			<div class="content">
				<div class="top">
					<input type="text" placeholder="Search settings..." />
				</div>
				{use(this.selected).map((s) => tabs[s])}
			</div>
		</div>
	);
};
SettingsPage.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		font-family: sans-serif;

		background: var(--bg01);
		color: var(--fg);
	}

	h1,
	h2,
	h3 {
		padding: 0;
		margin: 0;
	}

	.sidebar {
		padding: 2em;
		display: flex;
		flex-direction: column;
	}
	.sidebar h1 {
		margin-bottom: 1em;
	}

	.sidebar .button {
		width: 15rem;
		display: flex;
		align-items: center;
		gap: 0.54rem;
		cursor: pointer;
		padding: 1rem;
		border-radius: 4px;

		font-size: 1.2em;
	}
	.sidebar .button.active {
		background: color-mix(in oklab, var(--accent) 20%, transparent);
	}
	.sidebar .button:hover {
		background: color-mix(in oklab, var(--accent) 10%, transparent);
	}

	.content {
		flex: 1;
		padding: 2em;
	}
	.content .top {
		display: flex;
		align-items: center;
		justify-content: right;
		gap: 1em;
		margin-bottom: 2em;
	}
	.content .top input {
		width: 20rem;
		height: 2.5rem;
		font-size: 1.2em;
		padding: 0.5em;
		border: 1px solid var(--bg20);
		border-radius: 4px;
		outline: none;

		background: var(--bg02);
		color: var(--fg);
	}
`;
