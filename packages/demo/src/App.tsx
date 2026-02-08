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
			<FlagEditor
				onFlagsChange={(flags) => {
					console.log("flags changed", flags);
					Object.assign(controller.flags, flags);
				}}
			/>
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
				<div class="tab-spacer"></div>
			</div>
			{use(this.activeTab).map((tab) =>
				tab === "browser" ? (
					<div class="browser-view">
						<form
							on:submit={(e: SubmitEvent) => {
								e.preventDefault();
								this.frame?.go(urlStore.url);
							}}
						>
							<input
								id="search"
								type="text"
								value={use(urlStore.url)}
								placeholder="Enter URL"
							/>
						</form>
						<iframe this={use(this.frameel)}></iframe>
					</div>
				) : (
					<RequestViewer
						frame={this.frame}
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
				)
			)}
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

		padding: 1em;
		background: black;
		box-sizing: border-box;
	}
	.tab-bar {
		display: flex;
		align-items: center;
		gap: 0.5em;
		margin-bottom: 0.75em;
	}
	.tab-button {
		border: 1px solid #333;
		background: #151515;
		color: #ddd;
		padding: 0.4em 0.9em;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.9em;
	}
	.tab-button.active {
		background: #2b2b2b;
		color: #fff;
		border-color: #555;
	}
	.tab-spacer {
		flex: 1;
	}
	.browser-view {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	iframe {
		background: white;
		flex: 1;
		border: none;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.5em;
		margin-bottom: 0.5em;
		font-size: 1em;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
`;
