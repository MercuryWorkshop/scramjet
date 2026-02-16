import { controller } from ".";
import { createStore, css, type Component } from "dreamland/core";
import { FlagEditor } from "./FlagEditor";
import { RequestViewer, type RequestEntry } from "./RequestViewer";

const urlStore = createStore(
	{
		url: "https://google.com",
	},
	{
		ident: "store",
		backing: "localstorage",
		autosave: "auto",
	}
);

const MAX_REQUESTS = 200;

export const App: Component<
	{},
	{},
	{
		activeTab: "browser" | "requests";
		frame: ReturnType<typeof controller.createFrame>;
		frameel: HTMLIFrameElement;
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

		let body = btoa(
			`<body style="background: #000; color: #fff">Welcome to <i>Scramjet</i>! Type in a URL in the omnibox above and press enter to get started.</body>`
		);
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
					<input
						id="search"
						class="url-input"
						type="text"
						value={use(urlStore.url)}
						placeholder="Enter URL"
					/>
				</form>
				<div class="top-actions">
					<FlagEditor
						inline={true}
						onFlagsChange={(flags) => {
							console.log("flags changed", flags);
							Object.assign(controller.flags, flags);
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
					maxRequests={MAX_REQUESTS}
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
		</div>
	);
};

App.style = css`
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

		padding: 0.5em;
		background: black;
		box-sizing: border-box;
	}
	.top-bar {
		display: flex;
		align-items: center;
		gap: 0.6em;
		margin-bottom: 0.5em;
	}
	.tab-bar {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}
	.tab-button {
		border: 1px solid #333;
		background: #151515;
		color: #ddd;
		padding: 0.4em 0.9em;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9em;
	}
	.tab-button.active {
		background: #2b2b2b;
		color: #fff;
		border-color: #555;
	}
	.top-actions {
		display: flex;
		align-items: center;
	}
	.browser-view {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.tab-panel {
		flex: 1;
		min-height: 0;
		display: none;
	}
	.tab-panel.active {
		display: flex;
	}
	.requests-panel {
		flex-direction: column;
	}
	iframe {
		background: white;
		flex: 1;
		border: none;
	}
	.url-form {
		flex: 1;
		display: none;
	}
	.url-form.active {
		display: flex;
	}
	.url-input {
		box-sizing: border-box;
		width: 100%;
		max-width: 680px;
		margin-left: auto;
		margin-right: auto;
		padding: 0.4em 0.7em;
		font-size: 0.88em;
		border-radius: 9px;
		border: 1px solid #2a2a2a;
		background: #111;
		color: #f3f4f6;
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
	}
	.url-input::placeholder {
		color: #6b7280;
	}
	.url-input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
	}
`;
