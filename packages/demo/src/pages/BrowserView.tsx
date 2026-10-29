import { css, type Component, createState } from "dreamland/core";
import {
	CatchEscapedLinksPlugin,
	UrlWatcherPlugin,
} from "@mercuryworkshop/scramjet-utils";
import { cachePlugin, controller } from "..";
import {
	getSearchEngine,
	getSearchUrl,
	isSearchEngine,
	proxyPreferencesStore,
	sanitizeShortcuts,
	SEARCH_ENGINES,
} from "../store";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import homepage from "./homepage.html?raw";

const HOME_PAGE_CHANNEL = "tcms-proxy-home";
const HOME_PAGE_LABEL = "TCMs Proxy";
let homePageDataUrl = "";

export const browserState = createState({
	url: HOME_PAGE_LABEL,
	frame: null! as Frame,
	frameel: null! as HTMLIFrameElement,
	isHome: true,
});

function resolveNavigationInput(value: string, engine: unknown): string | null {
	const input = value.trim();
	if (!input) return null;

	const looksLikeWebAddress =
		/^https?:\/\//i.test(input) ||
		/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,})(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(
			input,
		);

	if (looksLikeWebAddress) {
		try {
			const parsed = new URL(
				/^https?:\/\//i.test(input) ? input : `https://${input}`,
			);
			if (parsed.protocol === "http:" || parsed.protocol === "https:") {
				return parsed.href;
			}
		} catch {
			// An incomplete address is treated as a search instead.
		}
	}

	return getSearchUrl(input, engine);
}

export function navigateToUrl(value: string): boolean {
	try {
		const target = new URL(value);
		if (target.protocol !== "http:" && target.protocol !== "https:")
			return false;

		browserState.isHome = false;
		browserState.url = target.href;
		browserState.frame?.go(target.href);
		return true;
	} catch {
		return false;
	}
}

export function navigateFromInput(value: string): boolean {
	const target = resolveNavigationInput(
		value,
		proxyPreferencesStore.searchEngine,
	);
	return target ? navigateToUrl(target) : false;
}

export function openProxyHome() {
	if (!homePageDataUrl || !browserState.frameel) return;
	browserState.isHome = true;
	browserState.url = HOME_PAGE_LABEL;
	browserState.frameel.src = homePageDataUrl;
}

export function syncHomePageState() {
	if (!browserState.isHome || !browserState.frameel?.contentWindow) return;

	browserState.frameel.contentWindow.postMessage(
		{
			channel: HOME_PAGE_CHANNEL,
			type: "state",
			searchEngine: getSearchEngine(proxyPreferencesStore.searchEngine),
			shortcuts: sanitizeShortcuts(proxyPreferencesStore.shortcuts),
		},
		"*",
	);
}

export const Omnibox: Component = function () {
	const submitAddress = (event: SubmitEvent) => {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const input = form.querySelector(
			"input[name='address']",
		) as HTMLInputElement;
		navigateFromInput(input.value);
	};

	const changeSearchEngine = (event: Event) => {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (!isSearchEngine(value)) return;
		proxyPreferencesStore.searchEngine = value;
		syncHomePageState();
	};

	return (
		<form class="url-form" on:submit={submitAddress}>
			<div class="browser-omnibox-shell">
				<div class="omnibox-nav" aria-label="Browser navigation">
					<button
						type="button"
						class="nav-btn"
						aria-label="Go back"
						title="Back"
						on:click={() => browserState.frame?.back()}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m14.5 5-7 7 7 7" />
						</svg>
					</button>
					<button
						type="button"
						class="nav-btn"
						aria-label="Go forward"
						title="Forward"
						on:click={() => browserState.frame?.forward()}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m9.5 5 7 7-7 7" />
						</svg>
					</button>
					<button
						type="button"
						class="nav-btn"
						aria-label="Reload page"
						title="Reload"
						on:click={() => browserState.frame?.reload()}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M20 11a8 8 0 0 0-14.7-3L4 10" />
							<path d="M4 5v5h5M4 13a8 8 0 0 0 14.7 3L20 14" />
							<path d="M20 19v-5h-5" />
						</svg>
					</button>
					<button
						type="button"
						class="nav-btn home-nav-btn"
						aria-label="TCMs Proxy home"
						title="Home"
						on:click={openProxyHome}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m3.5 10.5 8.5-7 8.5 7" />
							<path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" />
						</svg>
					</button>
				</div>
				<div class="address-field">
					<svg class="address-icon" viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="10.8" cy="10.8" r="6.3" />
						<path d="m15.5 15.5 4.2 4.2" />
					</svg>
					<input
						id="search"
						name="address"
						class="url-input"
						type="text"
						value={use(browserState.url)}
						spellcheck="false"
						autocomplete="off"
						placeholder="Search or enter a website"
						aria-label="Search or enter a website"
					/>
				</div>
				<label class="engine-select-wrap">
					<span class="engine-caption">Search with</span>
					<select
						class="engine-select"
						value={use(proxyPreferencesStore.searchEngine)}
						aria-label="Search engine"
						on:change={changeSearchEngine}
					>
						{SEARCH_ENGINES.map((engine) => (
							<option value={engine.id}>{engine.label}</option>
						))}
					</select>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path d="m4 6 4 4 4-4" />
					</svg>
				</label>
				<button class="go-button" type="submit" aria-label="Go">
					Go
					<svg viewBox="0 0 20 20" aria-hidden="true">
						<path d="M3.5 10h12M10 4.5l5.5 5.5-5.5 5.5" />
					</svg>
				</button>
			</div>
		</form>
	);
};

Omnibox.style = css`
	:scope {
		display: block;
		width: 100%;
	}

	.url-form {
		width: 100%;
		margin: 0;
	}

	.browser-omnibox-shell {
		display: flex;
		align-items: center;
		width: 100%;
		min-width: 0;
		min-height: 48px;
		gap: 8px;
		padding: 5px 6px;
		border: 1px solid #2b3743;
		border-radius: 13px;
		background: #121922;
		box-shadow: 0 7px 20px rgb(0 0 0 / 12%);
	}

	.omnibox-nav {
		display: flex;
		align-items: center;
		gap: 2px;
		padding-right: 7px;
		border-right: 1px solid #2a3540;
	}

	.nav-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 31px;
		height: 31px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: #9daab7;
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease;
	}

	.nav-btn:hover {
		background: #202b36;
		color: #f2f5f7;
	}

	.nav-btn svg,
	.address-icon,
	.go-button svg,
	.engine-select-wrap > svg {
		width: 17px;
		height: 17px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.address-field {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 90px;
		gap: 9px;
		padding: 0 9px;
	}

	.address-icon {
		flex: 0 0 auto;
		color: #7f8c99;
	}

	.url-input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: 7px 0;
		border: 0;
		outline: none;
		background: transparent;
		color: #edf2f6;
		font: inherit;
		font-size: 14px;
	}

	.url-input::placeholder {
		color: #778493;
	}

	.engine-select-wrap {
		position: relative;
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: max-content;
		padding: 0 4px 0 11px;
		border-left: 1px solid #2a3540;
		color: #aeb9c4;
		font-size: 12px;
	}

	.engine-caption {
		color: #748292;
	}

	.engine-select {
		max-width: 105px;
		padding: 8px 17px 8px 2px;
		appearance: none;
		border: 0;
		outline: 0;
		background: transparent;
		color: #e7edf2;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.engine-select option {
		background: #121922;
		color: #edf2f6;
	}

	.engine-select-wrap > svg {
		position: absolute;
		right: 0;
		width: 13px;
		height: 13px;
		pointer-events: none;
		color: #7f8c99;
	}

	.go-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 72px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid #d58a55;
		border-radius: 9px;
		background: #d58a55;
		color: #1a1c1e;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			transform 140ms ease;
	}

	.go-button:hover {
		border-color: #eda36c;
		background: #eda36c;
	}

	.go-button:active {
		transform: translateY(1px);
	}

	.go-button svg {
		width: 15px;
		height: 15px;
	}

	@media (max-width: 700px) {
		.browser-omnibox-shell {
			gap: 5px;
		}

		.engine-caption {
			display: none;
		}

		.engine-select-wrap {
			padding-left: 8px;
		}

		.go-button {
			min-width: 38px;
			padding: 0 9px;
		}

		.go-button svg {
			display: none;
		}
	}

	@media (max-width: 460px) {
		.home-nav-btn {
			display: none;
		}

		.engine-select {
			max-width: 86px;
			font-size: 12px;
		}
	}
`;

const BrowserView: Component<
	{
		active: boolean;
	},
	{},
	{
		frameel: HTMLIFrameElement;
	}
> = function (cx) {
	cx.mount = async () => {
		await controller.wait();

		const handleHomeMessage = (event: MessageEvent) => {
			if (
				event.source !== this.frameel.contentWindow ||
				event.data?.channel !== HOME_PAGE_CHANNEL ||
				!browserState.isHome
			) {
				return;
			}

			const message = event.data as {
				type?: string;
				query?: unknown;
				url?: unknown;
				engine?: unknown;
				shortcuts?: unknown;
			};

			switch (message.type) {
				case "search": {
					const query = String(message.query ?? "")
						.trim()
						.slice(0, 500);
					if (query) navigateFromInput(query);
					break;
				}
				case "navigate": {
					const url = String(message.url ?? "").slice(0, 2048);
					navigateToUrl(url);
					break;
				}
				case "search-engine": {
					if (isSearchEngine(message.engine)) {
						proxyPreferencesStore.searchEngine = message.engine;
						syncHomePageState();
					}
					break;
				}
				case "save-shortcuts": {
					proxyPreferencesStore.shortcuts = sanitizeShortcuts(
						message.shortcuts,
					);
					syncHomePageState();
					break;
				}
			}
		};

		window.addEventListener("message", handleHomeMessage);

		const urlWatcher = new UrlWatcherPlugin((url) => {
			const isHomePage = url === homePageDataUrl;
			browserState.isHome = isHomePage;
			browserState.url = isHomePage ? HOME_PAGE_LABEL : url;
			if (isHomePage) requestAnimationFrame(syncHomePageState);
		});
		const catchEscapedLinks = new CatchEscapedLinksPlugin(
			(url) =>
				new URL(`/?goto=${encodeURIComponent(url.href)}`, location.origin),
		);

		browserState.frameel = this.frameel;
		browserState.frame = controller.createFrame(this.frameel, {
			plugins: [cachePlugin, urlWatcher, catchEscapedLinks],
		});

		this.frameel.addEventListener("load", syncHomePageState);
		homePageDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(homepage)}`;
		browserState.isHome = true;
		browserState.url = HOME_PAGE_LABEL;
		this.frameel.src = homePageDataUrl;

		const goto = new URL(location.href).searchParams.get("goto");
		if (goto) {
			navigateToUrl(goto);
			history.replaceState(null, "", location.href.split("?")[0]);
		}
	};

	return (
		<div
			class={use(this.active).map(
				(active) => `tab-panel browser-view ${active ? "active" : ""}`,
			)}
		>
			<iframe
				this={use(this.frameel)}
				title="TCMs Proxy browser"
			></iframe>
		</div>
	);
};

BrowserView.style = css`
	:scope {
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		display: none;
		flex-direction: column;
		background: #f4f6f8;
	}

	:scope.active {
		display: flex;
	}

	iframe {
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		border: none;
		background: #f4f6f8;
	}
`;

export default BrowserView;
