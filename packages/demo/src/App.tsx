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

const normalizeHeaders = (
	input?: Headers | Array<[string, string]> | Record<string, string> | null
): Array<[string, string]> => {
	if (!input) return [];
	if (typeof (input as any).toRawHeaders === "function") {
		return (input as any).toRawHeaders();
	}
	if (input instanceof Headers) return [...input.entries()];
	if (Array.isArray(input)) return input;
	return Object.entries(input);
};

const getBodyPreview = (body: unknown): { preview: string; size?: number } => {
	if (body == null) return { preview: "" };
	if (typeof body === "string") {
		return { preview: body, size: body.length };
	}
	if (body instanceof ArrayBuffer) {
		const view = new Uint8Array(body);
		const decoded = new TextDecoder().decode(view);
		return { preview: decoded, size: view.byteLength };
	}
	if (body instanceof Blob) {
		const description = `Blob(${body.type || "unknown"}, ${body.size} bytes)`;
		return { preview: description, size: body.size };
	}
	if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
		return { preview: "ReadableStream" };
	}
	return { preview: String(body) };
};

export const App: Component<
	{},
	{},
	{
		activeTab: "browser" | "requests";
		frame: ReturnType<typeof controller.createFrame>;
		frameel: HTMLIFrameElement;
		requestSeq: number;
		requestIdByRequest: WeakMap<object, string>;
		requestStartByRequest: WeakMap<object, number>;
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
		this.requestSeq = 0;
		this.requestIdByRequest = new WeakMap();
		this.requestStartByRequest = new WeakMap();

		this.frame = controller.createFrame(this.frameel);

		const ScramjetPlugin = (globalThis as any).$scramjet?.Plugin;
		if (ScramjetPlugin) {
			const plugin = new ScramjetPlugin("demo-request-viewer");
			plugin.tap(this.frame.hooks.fetch.request, (context: any, props: any) => {
				const id = `${Date.now()}-${++this.requestSeq}`;
				const url = props.url?.toString?.() ?? context.parsed.url.toString();
				this.requestIdByRequest.set(context.request as object, id);
				this.requestStartByRequest.set(
					context.request as object,
					performance.now()
				);
				const reqHeaders = normalizeHeaders(props.init?.headers);
				const reqHeadersPre = normalizeHeaders(context.request.initialHeaders);
				const reqBodyInfo = getBodyPreview(props.init?.body);

				const entry: RequestEntry = {
					id,
					method: context.request.method,
					url,
					time: new Date().toLocaleTimeString(),
					destination: context.request.destination,
					mode: context.request.mode,
					requestHeadersPre: reqHeadersPre,
					requestHeaders: reqHeaders,
					requestBodyPreview: reqBodyInfo.preview,
					requestBodySize: reqBodyInfo.size,
				};

				this.requests = [entry, ...this.requests].slice(0, MAX_REQUESTS);
				if (!this.selectedId) {
					this.selectedId = id;
				}
			});

			plugin.tap(
				this.frame.hooks.fetch.preresponse,
				(context: any, props: any) => {
					const id = this.requestIdByRequest.get(context.request as object);
					if (!id) return;
					const preHeaders = normalizeHeaders(props.response?.rawHeaders);
					const preBodyInfo = getBodyPreview(props.response?.body);

					this.requests = this.requests.map((entry) =>
						entry.id === id
							? {
									...entry,
									responseHeadersPre: preHeaders,
									responseBodyPreviewPre: preBodyInfo.preview,
									responseBodySizePre: preBodyInfo.size,
								}
							: entry
					);
				}
			);

			plugin.tap(
				this.frame.hooks.fetch.response,
				(context: any, props: any) => {
					const id = this.requestIdByRequest.get(context.request as object);
					if (!id) return;
					const start = this.requestStartByRequest.get(
						context.request as object
					);
					const durationMs =
						start !== undefined
							? Math.max(0, Math.round(performance.now() - start))
							: undefined;
					const contentType = props.response.headers?.get?.("content-type");
					const respHeaders = normalizeHeaders(
						props.response.headers?.toRawHeaders?.()
					);
					const respBodyInfo = getBodyPreview(props.response.body);

					this.requests = this.requests.map((entry) =>
						entry.id === id
							? {
									...entry,
									status: props.response.status,
									statusText: props.response.statusText,
									durationMs,
									contentType,
									responseHeaders: respHeaders,
									responseBodyPreview: respBodyInfo.preview,
									responseBodySize: respBodyInfo.size,
								}
							: entry
					);
				}
			);
		} else {
			console.warn(
				"Scramjet Plugin API not available; request viewer disabled."
			);
		}

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
						requests={use(this.requests)}
						selectedId={use(this.selectedId)}
						maxRequests={MAX_REQUESTS}
						onSelect={(id) => {
							this.selectedId = id;
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
