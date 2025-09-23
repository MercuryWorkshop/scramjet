import { css, type Component } from "dreamland/core";
import type { Tab } from "../Tab";
import type { IconifyIcon } from "@iconify/types";
import { Icon } from "../components/Icon";
import { browser } from "../Browser";

import iconSettings from "@ktibow/iconset-ion/settings-outline";
import iconSearch from "@ktibow/iconset-ion/search-outline";
import iconExtension from "@ktibow/iconset-ion/extension-puzzle-outline";
import iconPrivacy from "@ktibow/iconset-ion/shield-checkmark-outline";
import iconAbout from "@ktibow/iconset-ion/information-circle-outline";

export const SettingsPage: Component<
	{
		tab: Tab;
	},
	{
		selected: string;
		searchQuery: string;
	}
> = function () {
	this.selected = "general";
	this.searchQuery = "";

	const button = (id: string, icon: IconifyIcon, name: string) => {
		return (
			<div
				class="nav-button"
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

	const handleSearch = (e: Event) => {
		this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
	};

	return (
		<div class="settings-page">
			<div class="sidebar">
				<h1>Settings</h1>
				<nav class="navigation">
					{button("general", iconSettings, "General")}
					{button("search", iconSearch, "Search")}
					{button("privacy", iconPrivacy, "Privacy & Security")}
					{button("extensions", iconExtension, "Extensions")}
					{button("about", iconAbout, "About")}
				</nav>
			</div>
			<div class="content">
				<div class="search-container">
					<div class="search-input">
						<Icon icon={iconSearch} />
						<input
							type="text"
							placeholder="Search settings..."
							value={this.searchQuery}
							on:input={handleSearch}
						/>
						{this.searchQuery && (
							<button
								class="clear-search"
								on:click={() => {
									this.searchQuery = "";
								}}
							>
								×
							</button>
						)}
					</div>
				</div>
				<div class="settings-content">
					{/* General Tab */}
					{use(this.selected).map((selected) =>
						selected === "general" ? (
							<div class="settings-tab">
								<h2>General Settings</h2>

								<section class="setting-section">
									<div class="section-header">
										<h3>Appearance</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<h4>Theme</h4>
											<div class="radio-group">
												<div class="radio-option">
													<input
														type="radio"
														id="theme-system"
														name="theme"
														value="system"
														checked={browser.settings.theme === "system"}
														on:change={() => {
															browser.settings.theme = "system";
														}}
													/>
													<label for="theme-system">System Default</label>
												</div>
												<div class="radio-option">
													<input
														type="radio"
														id="theme-dark"
														name="theme"
														value="dark"
														checked={browser.settings.theme === "dark"}
														on:change={() => {
															browser.settings.theme = "dark";
														}}
													/>
													<label for="theme-dark">Dark</label>
												</div>
												<div class="radio-option">
													<input
														type="radio"
														id="theme-light"
														name="theme"
														value="light"
														checked={browser.settings.theme === "light"}
														on:change={() => {
															browser.settings.theme = "light";
														}}
													/>
													<label for="theme-light">Light</label>
												</div>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Startup</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<h4>When Browser Starts</h4>
											<div class="radio-group">
												<div class="radio-option">
													<input
														type="radio"
														id="startup-new-tab"
														name="startupPage"
														value="new-tab"
														checked={browser.settings.startupPage === "new-tab"}
														on:change={() => {
															browser.settings.startupPage = "new-tab";
														}}
													/>
													<label for="startup-new-tab">Open New Tab Page</label>
												</div>
												<div class="radio-option">
													<input
														type="radio"
														id="startup-continue"
														name="startupPage"
														value="continue"
														checked={
															browser.settings.startupPage === "continue"
														}
														on:change={() => {
															browser.settings.startupPage = "continue";
														}}
													/>
													<label for="startup-continue">
														Continue where you left off
													</label>
												</div>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Default Zoom</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="zoom-control">
												<span class="zoom-value">
													{browser.settings.defaultZoom}%
												</span>
												<input
													type="range"
													min="50"
													max="200"
													step="10"
													value={browser.settings.defaultZoom}
													on:input={(e: Event) => {
														browser.settings.defaultZoom = parseInt(
															(e.target as HTMLInputElement).value
														);
													}}
												/>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Bookmarks</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="checkbox-option">
												<input
													type="checkbox"
													id="show-bookmarks-bar"
													checked={browser.settings.showBookmarksBar}
													on:change={() => {
														browser.settings.showBookmarksBar =
															!browser.settings.showBookmarksBar;
													}}
												/>
												<label for="show-bookmarks-bar">
													Always show bookmarks bar
												</label>
											</div>
										</div>
									</div>
								</section>
							</div>
						) : null
					)}

					{/* Search Tab */}
					{use(this.selected).map((selected) =>
						selected === "search" ? (
							<div class="settings-tab">
								<h2>Search Settings</h2>

								<section class="setting-section">
									<div class="section-header">
										<h3>Default Search Engine</h3>
										<p class="description">
											Choose which search engine to use when searching from the
											address bar
										</p>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<select
												class="select-input"
												value={browser.settings.defaultSearchEngine}
												on:change={(e: Event) => {
													browser.settings.defaultSearchEngine = (
														e.target as HTMLSelectElement
													).value as any;
												}}
											>
												<option value="google">Google</option>
												<option value="bing">Bing</option>
												<option value="duckduckgo">DuckDuckGo</option>
												<option value="yahoo">Yahoo</option>
												<option value="ecosia">Ecosia</option>
												<option value="startpage">Startpage</option>
											</select>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Search Suggestions</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="checkbox-option">
												<input
													type="checkbox"
													id="search-suggestions"
													checked={browser.settings.searchSuggestionsEnabled}
													on:change={() => {
														browser.settings.searchSuggestionsEnabled =
															!browser.settings.searchSuggestionsEnabled;
													}}
												/>
												<label for="search-suggestions">
													Show search and site suggestions in the address bar
												</label>
											</div>
										</div>
									</div>
								</section>
							</div>
						) : null
					)}

					{/* Privacy Tab */}
					{use(this.selected).map((selected) =>
						selected === "privacy" ? (
							<div class="settings-tab">
								<h2>Privacy & Security</h2>

								<section class="setting-section">
									<div class="section-header">
										<h3>Trackers & Site Data</h3>
										<p class="description">
											Control how the browser handles trackers and your data
										</p>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="checkbox-option">
												<input
													type="checkbox"
													id="block-trackers"
													checked={browser.settings.blockTrackers}
													on:change={() => {
														browser.settings.blockTrackers =
															!browser.settings.blockTrackers;
													}}
												/>
												<label for="block-trackers">
													Block third-party trackers
												</label>
											</div>

											<div class="checkbox-option">
												<input
													type="checkbox"
													id="do-not-track"
													checked={browser.settings.doNotTrack}
													on:change={() => {
														browser.settings.doNotTrack =
															!browser.settings.doNotTrack;
													}}
												/>
												<label for="do-not-track">
													Send 'Do Not Track' with browsing requests
												</label>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Browsing History</h3>
										<p class="description">
											Control what data is saved or cleared
										</p>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="checkbox-option">
												<input
													type="checkbox"
													id="clear-history"
													checked={browser.settings.clearHistoryOnExit}
													on:change={() => {
														browser.settings.clearHistoryOnExit =
															!browser.settings.clearHistoryOnExit;
													}}
												/>
												<label for="clear-history">
													Clear history when browser closes
												</label>
											</div>

											<button class="action-button">
												Clear Browsing Data...
											</button>
										</div>
									</div>
								</section>
							</div>
						) : null
					)}

					{/* Extensions Tab */}
					{use(this.selected).map((selected) =>
						selected === "extensions" ? (
							<div class="settings-tab">
								<h2>Extensions</h2>

								<section class="setting-section">
									<div class="section-header">
										<h3>Installed Extensions</h3>
										<p class="description">Manage your browser extensions</p>
									</div>
									<div class="section-content">
										<div class="extensions-list">
											<div class="extension-item">
												<div class="extension-info">
													<div class="extension-icon placeholder"></div>
													<div class="extension-details">
														<h4>No extensions installed</h4>
														<p>Extensions will appear here once installed</p>
													</div>
												</div>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Developer Mode</h3>
									</div>
									<div class="section-content">
										<div class="setting-group">
											<div class="checkbox-option">
												<input
													type="checkbox"
													id="dev-mode"
													checked={browser.settings.extensionsDevMode}
													on:change={() => {
														browser.settings.extensionsDevMode =
															!browser.settings.extensionsDevMode;
													}}
												/>
												<label for="dev-mode">Enable developer mode</label>
											</div>

											{browser.settings.extensionsDevMode && (
												<div class="dev-buttons">
													<button class="action-button">Load Unpacked</button>
													<button class="action-button">Pack Extension</button>
												</div>
											)}
										</div>
									</div>
								</section>
							</div>
						) : null
					)}

					{/* About Tab */}
					{use(this.selected).map((selected) =>
						selected === "about" ? (
							<div class="settings-tab">
								<h2>About</h2>

								<section class="setting-section">
									<div class="section-header">
										<h3>Browser Information</h3>
									</div>
									<div class="section-content">
										<div class="about-info">
											<div class="browser-logo placeholder"></div>
											<div class="browser-info">
												<h3>Browser.js</h3>
												<p>Version 1.0.0</p>
												<p>© 2023 Browser.js Team</p>
											</div>
										</div>
									</div>
								</section>

								<section class="setting-section">
									<div class="section-header">
										<h3>Open Source</h3>
									</div>
									<div class="section-content">
										<p>
											This browser is built with open source software. View the
											source code on GitHub.
										</p>
										<a
											href="https://github.com/browserjs/browser.js"
											class="link"
										>
											GitHub Repository
										</a>
									</div>
								</section>
							</div>
						) : null
					)}
				</div>
			</div>
		</div>
	);
};

SettingsPage.style = css`
	:scope {
		width: 100%;
		height: 100%;
		display: flex;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			Roboto,
			Oxygen,
			Ubuntu,
			Cantarell,
			"Open Sans",
			"Helvetica Neue",
			sans-serif;
		background: var(--bg01);
		color: var(--fg);
		overflow: hidden;
	}

	h1,
	h2,
	h3,
	h4,
	p {
		margin: 0;
		padding: 0;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1.5rem;
	}

	h2 {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: 1.5rem;
		color: var(--fg);
	}

	h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--fg);
	}

	h4 {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--fg);
		margin-bottom: 0.5rem;
	}

	p {
		color: var(--fg2);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.sidebar {
		width: 250px;
		padding: 2rem;
		background: var(--bg01);
		border-right: 1px solid var(--bg10);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.navigation {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		font-size: 0.95rem;
		color: var(--fg);
	}

	.nav-button:hover {
		background: var(--bg05);
	}

	.nav-button.active {
		background: color-mix(in oklab, var(--accent) 15%, transparent);
		color: var(--accent);
		font-weight: 500;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.search-container {
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--bg10);
	}

	.search-input {
		position: relative;
		width: 100%;
		max-width: 24rem;
		margin-left: auto;
	}

	.search-input input {
		width: 100%;
		height: 2.5rem;
		padding: 0 2.5rem;
		border-radius: 6px;
		border: 1px solid var(--bg15);
		background: var(--bg02);
		color: var(--fg);
		font-size: 0.95rem;
		outline: none;
		transition: all 0.2s ease;
	}

	.search-input input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 20%, transparent);
	}

	.search-input .icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--fg3);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--fg3);
		font-size: 1.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}

	.clear-search:hover {
		background: var(--bg10);
	}

	.settings-content {
		flex: 1;
		padding: 1.5rem 2rem 2rem;
		overflow-y: auto;
	}

	.settings-tab {
		max-width: 50rem;
	}

	.setting-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--bg10);
	}

	.setting-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.section-header {
		margin-bottom: 1rem;
	}

	.description {
		margin-top: 0.25rem;
		color: var(--fg3);
	}

	.section-content {
		padding-left: 0.5rem;
	}

	.setting-group {
		margin-bottom: 1.5rem;
	}

	.setting-group:last-child {
		margin-bottom: 0;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-option,
	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.radio-option:last-child,
	.checkbox-option:last-child {
		margin-bottom: 0;
	}

	.radio-option label,
	.checkbox-option label {
		font-size: 0.95rem;
		cursor: pointer;
	}

	input[type="radio"],
	input[type="checkbox"] {
		accent-color: var(--accent);
	}

	.zoom-control {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.zoom-value {
		min-width: 3rem;
		font-size: 0.95rem;
		font-weight: 500;
	}

	input[type="range"] {
		flex: 1;
		max-width: 20rem;
		accent-color: var(--accent);
	}

	.select-input {
		padding: 0.5rem;
		border-radius: 4px;
		border: 1px solid var(--bg15);
		background: var(--bg02);
		color: var(--fg);
		font-size: 0.9rem;
		min-width: 15rem;
		outline: none;
	}

	.select-input:focus {
		border-color: var(--accent);
	}

	.action-button {
		margin-top: 1rem;
		background: var(--bg05);
		border: 1px solid var(--bg15);
		color: var(--fg);
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-button:hover {
		background: var(--bg10);
	}

	.dev-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.extensions-list {
		border: 1px solid var(--bg10);
		border-radius: 6px;
		overflow: hidden;
	}

	.extension-item {
		padding: 1rem;
		border-bottom: 1px solid var(--bg10);
	}

	.extension-item:last-child {
		border-bottom: none;
	}

	.extension-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.extension-icon {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 6px;
		background: var(--bg10);
	}

	.extension-details h4 {
		margin-bottom: 0.25rem;
	}

	.extension-details p {
		font-size: 0.85rem;
		color: var(--fg3);
	}

	.about-info {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.browser-logo {
		width: 5rem;
		height: 5rem;
		border-radius: 8px;
		background: var(--accent);
	}

	.browser-info h3 {
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}

	.browser-info p {
		margin-bottom: 0.25rem;
	}

	.link {
		display: inline-block;
		margin-top: 0.75rem;
		color: var(--accent);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.placeholder {
		position: relative;
		overflow: hidden;
	}

	.placeholder::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--bg05) 0%,
			var(--bg10) 50%,
			var(--bg05) 100%
		);
		animation: shimmer 1.5s infinite;
		background-size: 200% 100%;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
`;
