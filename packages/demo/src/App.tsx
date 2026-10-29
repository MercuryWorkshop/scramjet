import { css, type Component } from "dreamland/core";
import FlagEditor from "./components/FlagEditor";
import BrowserView, { Omnibox, openProxyHome } from "./pages/BrowserView";
import RequestViewer, { requestsState } from "./pages/RequestViewer";
import PlaygroundView from "./pages/Playground";
import SettingsView from "./pages/SettingsPage";

type ActiveTab = "browser" | "requests" | "playground" | "settings";

const App: Component<{}, {}, { activeTab: ActiveTab }> = function () {
	this.activeTab ??= "browser";

	const selectTab = (tab: ActiveTab) => {
		this.activeTab = tab;
	};

	return (
		<div class="app-shell">
			<header class="app-header">
				<button
					class="brand-block"
					type="button"
					aria-label="Return to TCMs Proxy home"
					on:click={() => {
						this.activeTab = "browser";
						openProxyHome();
					}}
				>
					<span class="brand-mark" aria-hidden="true">
						TC
					</span>
					<span class="brand-copy">
						<strong>TCMs Proxy</strong>
						<small>WEB, YOUR WAY</small>
					</span>
				</button>

				<nav class="main-nav" role="tablist" aria-label="Main navigation">
					<button
						class={use(this.activeTab).map(
							(tab) => `nav-tab ${tab === "browser" ? "active" : ""}`,
						)}
						role="tab"
						aria-selected={use(this.activeTab).map((tab) => tab === "browser")}
						type="button"
						on:click={() => selectTab("browser")}
					>
						<svg class="nav-icon" viewBox="0 0 20 20" aria-hidden="true">
							<path d="m2.5 8.7 7.5-6 7.5 6M4.5 7.5v10h11v-10M8 17.5v-6h4v6" />
						</svg>
						Browse
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `nav-tab ${tab === "requests" ? "active" : ""}`,
						)}
						role="tab"
						aria-selected={use(this.activeTab).map((tab) => tab === "requests")}
						type="button"
						on:click={() => selectTab("requests")}
					>
						<svg class="nav-icon" viewBox="0 0 20 20" aria-hidden="true">
							<path d="M4 4.5h12M4 8.5h12M4 12.5h8M4 16h6" />
							<path d="M2.5 2.5h15v15h-15z" />
						</svg>
						Requests{" "}
						{use(requestsState.requests).map((requests) =>
							requests.length ? (
								<span class="request-count">{requests.length}</span>
							) : null,
						)}
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `nav-tab ${tab === "playground" ? "active" : ""}`,
						)}
						role="tab"
						aria-selected={use(this.activeTab).map(
							(tab) => tab === "playground",
						)}
						type="button"
						on:click={() => selectTab("playground")}
					>
						<svg
							class="nav-icon code-icon"
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path d="m7 5-4 5 4 5M13 5l4 5-4 5M11.5 3l-3 14" />
						</svg>
						Playground
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `nav-tab ${tab === "settings" ? "active" : ""}`,
						)}
						role="tab"
						aria-selected={use(this.activeTab).map((tab) => tab === "settings")}
						type="button"
						on:click={() => selectTab("settings")}
					>
						<svg class="nav-icon" viewBox="0 0 20 20" aria-hidden="true">
							<circle cx="10" cy="10" r="3" />
							<path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
						</svg>
						Settings
					</button>
				</nav>

				<div class="header-actions">
					<div class="service-status">
						<span class="status-dot" aria-hidden="true"></span>
						<span>Proxy ready</span>
					</div>
					<FlagEditor inline={true} />
				</div>
			</header>

			{use(this.activeTab)
				.map((tab) => tab === "browser")
				.andThen(
					<div class="browser-toolbar">
						<Omnibox />
					</div>,
				)}

			<main class="workspace">
				<div
					class={use(this.activeTab).map(
						(tab) =>
							`tab-panel browser-panel ${tab === "browser" ? "active" : ""}`,
					)}
				>
					<BrowserView
						active={use(this.activeTab).map((tab) => tab === "browser")}
					/>
				</div>
				<div
					class={use(this.activeTab).map(
						(tab) =>
							`tab-panel requests-panel ${tab === "requests" ? "active" : ""}`,
					)}
				>
					<RequestViewer
						active={use(this.activeTab).map((tab) => tab === "requests")}
					/>
				</div>
				<div
					class={use(this.activeTab).map(
						(tab) =>
							`tab-panel playground-panel ${tab === "playground" ? "active" : ""}`,
					)}
				>
					<PlaygroundView
						active={use(this.activeTab).map((tab) => tab === "playground")}
					/>
				</div>
				<div
					class={use(this.activeTab).map(
						(tab) =>
							`tab-panel settings-tab ${tab === "settings" ? "active" : ""}`,
					)}
				>
					<SettingsView />
				</div>
			</main>
		</div>
	);
};

App.style = css`
	:scope {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		display: flex;
		width: 100vw;
		height: 100vh;
		flex-direction: column;
		overflow: hidden;
		background: #0d1217;
		color: #e8edf1;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			"Segoe UI",
			sans-serif;
		box-sizing: border-box;
	}

	.app-shell {
		display: flex;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
	}

	.app-header {
		position: relative;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 26px;
		min-height: 68px;
		padding: 0 22px;
		border-bottom: 1px solid #232d36;
		background: #0f151b;
	}

	.brand-block {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
		gap: 10px;
		min-width: 153px;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.brand-mark {
		display: grid;
		width: 36px;
		height: 36px;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid #55402f;
		border-radius: 10px;
		background: #28241f;
		color: #f1b17d;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: -0.08em;
		transition:
			border-color 140ms ease,
			background 140ms ease;
	}

	.brand-block:hover .brand-mark {
		border-color: #865b3c;
		background: #332a23;
	}

	.brand-copy {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.brand-copy strong {
		color: #f2f4f6;
		font-size: 14px;
		font-weight: 720;
		letter-spacing: -0.025em;
	}

	.brand-copy small {
		color: #81909c;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.main-nav {
		display: flex;
		align-self: stretch;
		align-items: center;
		flex: 1;
		gap: 4px;
		min-width: 0;
	}

	.nav-tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid transparent;
		border-radius: 9px;
		background: transparent;
		color: #9aa7b2;
		font: inherit;
		font-size: 12px;
		font-weight: 590;
		white-space: nowrap;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease,
			color 140ms ease;
	}

	.nav-tab:hover {
		background: #18212a;
		color: #e4e9ed;
	}

	.nav-tab.active {
		border-color: #2b3741;
		background: #1a242d;
		color: #f2f5f7;
	}

	.nav-tab.active::after {
		position: absolute;
		right: 12px;
		bottom: -17px;
		left: 12px;
		height: 2px;
		border-radius: 2px 2px 0 0;
		background: #d58a55;
		content: "";
	}

	.nav-icon {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.55;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: #93a1ad;
	}

	.nav-tab.active .nav-icon {
		color: #e6a16f;
	}

	.request-count {
		display: inline-grid;
		min-width: 18px;
		height: 18px;
		place-items: center;
		padding: 0 4px;
		border-radius: 6px;
		background: #2e3942;
		color: #d4dce2;
		font-size: 10px;
		font-weight: 650;
		line-height: 1;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 15px;
		margin-left: auto;
	}

	.service-status {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #9eabb5;
		font-size: 11px;
		white-space: nowrap;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #6eb58a;
		box-shadow: 0 0 0 3px rgb(110 181 138 / 12%);
	}

	.browser-toolbar {
		position: relative;
		z-index: 10;
		padding: 10px 20px;
		border-bottom: 1px solid #232d36;
		background: #111820;
	}

	.workspace {
		display: flex;
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
		background: #0d1217;
	}

	.tab-panel {
		display: none;
		width: 100%;
		min-width: 0;
		min-height: 0;
		flex: 1;
	}

	.tab-panel.active {
		display: flex;
	}

	.browser-panel {
		flex-direction: column;
	}

	.requests-panel {
		flex-direction: column;
	}

	.playground-panel,
	.settings-tab {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}

	@media (max-width: 860px) {
		.app-header {
			gap: 13px;
			padding-right: 14px;
			padding-left: 14px;
		}

		.brand-block {
			min-width: auto;
		}

		.nav-tab {
			gap: 6px;
			padding: 0 9px;
			font-size: 11px;
		}

		.header-actions {
			gap: 10px;
		}

		.service-status {
			display: none;
		}
	}

	@media (max-width: 680px) {
		.app-header {
			min-height: auto;
			flex-wrap: wrap;
			row-gap: 8px;
			padding: 10px 12px 0;
		}

		.brand-block {
			min-height: 37px;
		}

		.header-actions {
			margin-left: auto;
		}

		.main-nav {
			order: 3;
			flex-basis: 100%;
			min-height: 42px;
			overflow-x: auto;
		}

		.nav-tab {
			min-height: 34px;
			padding: 0 10px;
		}

		.nav-tab.active::after {
			bottom: -4px;
		}

		.browser-toolbar {
			padding: 9px 10px;
		}
	}

	@media (max-width: 420px) {
		.brand-copy small {
			display: none;
		}

		.header-actions {
			gap: 5px;
		}

		.nav-tab {
			gap: 5px;
			padding: 0 8px;
			font-size: 10px;
		}
	}
`;

export default App;
