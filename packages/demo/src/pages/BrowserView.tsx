import {
	css,
	type Delegate,
	type Component,
	createState,
} from "dreamland/core";
const { Plugin: ScramjetPlugin } = window.$scramjet;
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { controller } from "..";
import { demoSettingsStore } from "../store";
import homepage from "./homepage.html?raw";

export const browserState = createState({
	url: demoSettingsStore.homeUrl,
	frame: null! as Frame,
});

export const Omnibox: Component = function (cx) {
	const navigate = () => {
		if (!browserState.url.startsWith("http")) {
			browserState.url = `https://${browserState.url}`;
		}
		browserState.frame?.go(browserState.url);
	};
	return (
		<form
			class="url-form"
			on:submit={(e: SubmitEvent) => {
				e.preventDefault();
				navigate();
			}}
		>
			<div class="browser-omnibox-shell">
				<div class="omnibox-nav" aria-hidden="true">
					<button type="button" class="nav-btn">
						<span class="material-symbols-outlined">arrow_back</span>
					</button>
					<button type="button" class="nav-btn">
						<span class="material-symbols-outlined">arrow_forward</span>
					</button>
					<button type="button" class="nav-btn" on:click={navigate}>
						<span class="material-symbols-outlined">refresh</span>
					</button>
				</div>
				<input
					id="search"
					class="url-input"
					type="text"
					value={use(browserState.url)}
					spellcheck="false"
					placeholder="Enter URL or search..."
				/>
			</div>
		</form>
	);
};
Omnibox.style = css`
	:scope {
		display: flex;
		align-items: center;
		/*padding: 0.25em 0.45em;*/
		background: #0f0f0f;
		border-bottom: 1px solid #2a2a2a;
		min-width: 0;
		width: 100%;
	}
	.browser-omnibox-shell {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.35em;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 0;
		flex: 1;
	}
	.omnibox-nav {
		display: flex;
		align-items: center;
		gap: 0.15em;
		padding-right: 0.25em;
		border-right: 1px solid #2a2a2a;
	}
	.nav-btn {
		border: 0;
		background: transparent;
		color: #8f8f8f;
		width: 1.5em;
		height: 1.5em;
		padding: 0;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nav-btn:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.browser-omnibox-shell .material-symbols-outlined {
		font-size: 15px !important;
		line-height: 1 !important;
		font-variation-settings:
			"OPSZ" 20,
			"wght" 300,
			"FILL" 0,
			"GRAD" 0;
	}
	.url-input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.22em 0.18em;
		font-size: 0.9em;
		border: 1px solid transparent;
		border-radius: 3px;
		background: transparent;
		color: #e5e7eb;
		outline: none;
	}
	.url-input::placeholder {
		color: #6f7680;
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
		browserState.frame = controller.createFrame(this.frameel);
		const versionInfo = window.$scramjet.versionInfo ?? {};
		let realHomepage = homepage;
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_VERSION}}",
			String(versionInfo.version ?? "unknown")
		);
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_BUILD}}",
			String(versionInfo.build ?? "unknown")
		);
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_DATE_PRETTY}}",
			new Date(versionInfo.date).toLocaleString(undefined, {
				dateStyle: "short",
				timeStyle: "short",
			})
		);
		this.frameel.src = `data:text/html;base64,${btoa(realHomepage)}`;
		initPlugin(browserState.frame);
	};
	const initPlugin = (frame: Frame) => {
		const plugin = new ScramjetPlugin("url-watcher");
		plugin.tap(frame.hooks.frameInit.post, (context, props) => {
			if (!context.isTopLevel) return;
			browserState.url = context.client.url;
			plugin.tap(context.client.hooks.lifecycle.navigate, (context, props) => {
				browserState.url = props.url;
			});
		});
	};

	return (
		<div
			class={use(this.active).map(
				(active) => `tab-panel browser-view ${active ? "active" : ""}`
			)}
		>
			<iframe this={use(this.frameel)}></iframe>
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
	}
	:scope.active {
		display: flex;
	}

	iframe {
		background: white;
		flex: 1;
		border: none;
	}
`;

export default BrowserView;
