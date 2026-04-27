import { controller } from ".";
import { createStore, css, type Component } from "dreamland/core";
import { demoSettingsStore } from "./demoSettings";
import { FlagEditor } from "./FlagEditor";
import { RequestViewer, type RequestEntry } from "./RequestViewer";
import { PlaygroundPanel } from "./PlaygroundPanel";
import { ResponsePlayground } from "./ResponsePlayground";
import { SettingsPanel } from "./SettingsPanel";

const urlStore = createStore(
	{
		url: demoSettingsStore.homeUrl,
	},
	{
		ident: "store",
		backing: "localstorage",
		autosave: "auto",
	}
);
export const App: Component<
	{},
	{},
	{
		activeTab:
			| "browser"
			| "requests"
			| "playground"
			| "response-playground"
			| "settings";
		frame: ReturnType<typeof controller.createFrame>;
		frameel: HTMLIFrameElement;
		playgroundFrame: ReturnType<typeof controller.createFrame>;
		responsePlaygroundFrame: ReturnType<typeof controller.createFrame>;
		requests: RequestEntry[];
		selectedId: string | null;
	}
> = function (cx) {
	this.activeTab ??= "browser";
	this.requests ??= [];
	this.selectedId ??= null;
	cx.mount = async () => {
		await controller.wait();
		this.activeTab = "browser";
		this.requests = [];
		this.selectedId = null;

		this.frame = controller.createFrame(this.frameel);
		this.playgroundFrame = controller.createFrame();
		this.responsePlaygroundFrame = controller.createFrame();

		const versionInfo = (globalThis as any).$scramjet?.versionInfo ?? {};
		const scramjetVersion = String(versionInfo.version ?? "unknown");
		const scramjetBuild = String(versionInfo.build ?? "unknown");
		const scramjetDate = String(versionInfo.date ?? "unknown");
		const parsedScramjetDate = new Date(scramjetDate);
		const scramjetDatePretty = Number.isNaN(parsedScramjetDate.getTime())
			? scramjetDate
			: parsedScramjetDate.toLocaleString(undefined, {
					dateStyle: "short",
					timeStyle: "short",
				});

		let body = btoa(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scramjet Demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #0f0f0f;
        color: #e5e7eb;
        display: grid;
        place-items: start center;
        padding: 30px 18px;
      }
      .sheet {
        width: min(760px, 100%);
        /*border: 1px solid #222;
        background: #111;
		*/
        padding: 26px 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 1.55rem;
        font-weight: 650;
        letter-spacing: 0.005em;
      }
      .meta {
        color: #9ca3af;
        font-size: 0.78rem;
        margin: 0 0 20px;
      }
      .section {
        margin: 0 0 18px;
      }
      .label {
        display: block;
        margin-bottom: 6px;
        color: #e5e7eb;
        font-size: 1.1rem;
        font-weight: 630;
        letter-spacing: 0.01em;
        text-transform: none;
      }
      p {
        margin: 0;
        color: #c7c7c7;
        line-height: 1.62;
        font-size: 0.94rem;
        max-width: 70ch;
      }
      code {
        font-family: "SF Mono", Menlo, Consolas, monospace;
        color: #e5e7eb;
        background: #181818;
        border: 1px solid #2a2a2a;
        padding: 1px 5px;
      }
		a {
		color: inherit;
		text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1>Welcome to Scramjet!</h1>
      <p class="meta">Version ${scramjetVersion} | <a href="https://github.com/MercuryWorkshop/scramjet/commit/${scramjetBuild}">Build ${scramjetBuild}</a> | Updated ${scramjetDatePretty}</p>

      <section class="section">
        <p>
			<a href="https://github.com/MercuryWorkshop/scramjet"><strong>Scramjet</strong></a> is an experimental <strong>interception-based web proxy</strong>, designed to evade internet censorship and bypass arbitrary browser restrictions.<br><br>
			Scramjet allows you to sandbox arbitrary web content, bypass CORS restrictions on loading websites, and instrument and debug websites inside the browser itself. This is accomplished through a combination of interception, rewriting, and sandboxing techniques. You can learn more about the technical details <a href="https://developer.puter.com/blog/how-I-ported-the-web-to-the-web/"><strong>here</strong></a>.<br><br>
			If you're interested in contributing to scramjet, or want to build your own web proxy or application using it, you should check out the <a href="https://github.com/MercuryWorkshop/scramjet"><strong>GitHub repository</strong></a>.<br><br>
			This website is a demo of scramjet's capabilities, letting you browse the web proxied through scramjet, inspect how scramjet rewrites requests and responses, and see how scramjet handles your custom content in the playground.
		</p>
      </section>

      <section class="section">
        <span class="label">Browser</span>
        <p>
			Try entering a URL in the box above to browse the web proxied through scramjet.<br>
			All traffic sent through scramjet is <strong>fully end-to-end encrypted</strong> with TLS, powered by <a href="https://github.com/ading2210/libcurl.js"><strong>libcurl.js</strong></a> and the <a href="https://github.com/MercuryWorkshop/wisp-protocol"><strong>wisp protocol</strong></a>.
		</p>
      </section>

      <section class="section">
        <span class="label">Requests</span>
        <p>
			You can inspect all the requests sent through scramjet, and what transformations are applied in the requests tab.<br>
			Note that requests will not be captured until you first click on the requests tab.
		</p>
      </section>

      <section class="section">
        <span class="label">Playground</span>
        <p>
			The playground lets you write your own html/css/js snippets which will be run inside the scramjet sandbox.
			Your files are "served" by scramjet from a fake origin, which can be configured to be any URL. Notice that if you add a <code>console.log(location.href)</code> in your code, the page will really be running on the fake origin.

		</p>
      </section>
    </main>
  </body>
</html>`);
		this.frame.go(`data:text/html;base64,${body}`);
	};

	return (
		<div>
			<div class="top-bar">
				<div class="tab-bar">
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "browser" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "browser";
						}}
					>
						Browser
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "requests" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "requests";
						}}
					>
						Requests ({use(this.requests).map((reqs) => reqs.length)})
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "playground" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "playground";
						}}
					>
						Playground
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) =>
								`tab-button ${tab === "response-playground" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "response-playground";
						}}
					>
						Response Playground
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "settings" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "settings";
						}}
					>
						Settings
					</button>
				</div>
				<form
					class={use(this.activeTab).map(
						(tab) => `url-form ${tab === "browser" ? "active" : ""}`
					)}
					on:submit={(e: SubmitEvent) => {
						e.preventDefault();
						this.frame?.go(urlStore.url);
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
							<button
								type="button"
								class="nav-btn"
								on:click={() => {
									this.frame?.go(urlStore.url);
								}}
							>
								<span class="material-symbols-outlined">refresh</span>
							</button>
						</div>
						<input
							id="search"
							class="url-input"
							type="text"
							value={use(urlStore.url)}
							spellcheck="false"
							placeholder="Enter URL or search..."
						/>
					</div>
				</form>
				<div class="top-actions">
					<FlagEditor
						inline={true}
						onFlagsChange={(flags) => {
							Object.assign(controller.scramjetConfig.flags, flags);
						}}
					/>
				</div>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) => `tab-panel browser-view ${tab === "browser" ? "active" : ""}`
				)}
			>
				<iframe this={use(this.frameel)}></iframe>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel requests-panel ${tab === "requests" ? "active" : ""}`
				)}
			>
				<RequestViewer
					frame={use(this.frame)}
					active={use(this.activeTab).map((tab) => tab === "requests")}
					requests={use(this.requests)}
					selectedId={use(this.selectedId)}
					maxRequests={use(demoSettingsStore.maxRequests)}
					onSelect={(id) => {
						this.selectedId = id;
					}}
					onSelectedChange={(id) => {
						this.selectedId = id;
					}}
					onRequestsChange={(updater) => {
						this.requests = updater(this.requests);
					}}
					onClear={() => {
						this.requests = [];
						this.selectedId = null;
					}}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel playground-panel ${tab === "playground" ? "active" : ""}`
				)}
			>
				<PlaygroundPanel
					frame={use(this.playgroundFrame)}
					active={use(this.activeTab).map((tab) => tab === "playground")}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel response-playground-panel ${tab === "response-playground" ? "active" : ""}`
				)}
			>
				<ResponsePlayground
					frame={use(this.responsePlaygroundFrame)}
					active={use(this.activeTab).map(
						(tab) => tab === "response-playground"
					)}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel settings-tab ${tab === "settings" ? "active" : ""}`
				)}
			>
				<SettingsPanel
					onHomeUrlApply={(url) => {
						urlStore.url = url;
					}}
				/>
			</div>
		</div>
	);
};

App.style = css`
	@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0");

	:scope {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		margin: 0;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;

		padding: 0;
		background: black;
		box-sizing: border-box;
	}
	.material-symbols-outlined {
		font-family: "Material Symbols Outlined";
		font-weight: normal;
		font-style: normal;
		font-size: 11px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}
	.top-bar {
		display: flex;
		align-items: stretch;
		gap: 0;
		margin-bottom: 0;
		border-bottom: 1px solid #4a4a4a;
		background: #0f0f0f;
	}
	.tab-bar {
		display: flex;
		align-items: stretch;
		gap: 0;
	}
	.tab-button {
		border: 1px solid transparent;
		border-bottom: 0;
		background: transparent;
		color: #a8a8a8;
		padding: 0.24em 0.62em;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.84em;
		line-height: 1.2;
		min-height: 28px;
		margin: 0;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
	}
	.tab-button:hover {
		background: #181818;
		color: #d0d0d0;
	}
	.tab-button.active {
		background: #1f1f1f;
		color: #fff;
		border-color: #4a4a4a;
		margin-bottom: -1px;
	}
	.top-actions {
		display: flex;
		align-items: center;
		margin-left: auto;
		padding: 0 0.35em;
		min-height: 28px;
	}
	.browser-view {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.tab-panel {
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		display: none;
	}
	.tab-panel.active {
		display: flex;
	}
	.requests-panel {
		flex-direction: column;
	}
	.playground-panel {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	.response-playground-panel {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	.settings-tab {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	iframe {
		background: white;
		flex: 1;
		border: none;
	}
	.url-form {
		flex: 1;
		display: none;
		min-width: 0;
	}
	.url-form.active {
		display: flex;
		align-items: center;
		padding: 0 0.45em 0 0.2em;
	}
	.browser-omnibox-shell {
		display: flex;
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
	.url-input:focus {
		/* border-color: #7a7a7a; */
	}
`;
