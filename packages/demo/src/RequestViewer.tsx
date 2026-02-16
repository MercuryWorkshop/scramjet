import { css, type Component } from "dreamland/core";
import { MonacoComponent } from "./MonacoComponent";
import { RequestCard } from "./RequestCard";

export type RequestEntry = {
	id: string;
	method: string;
	url: string;
	time: string;
	destination?: string;
	mode?: string;
	status?: number;
	statusText?: string;
	durationMs?: number;
	contentType?: string;
	requestHeadersPre?: Array<[string, string]>;
	requestHeaders?: Array<[string, string]>;
	responseHeadersPre?: Array<[string, string]>;
	responseHeaders?: Array<[string, string]>;
	requestBodyPreview?: string;
	responseBodyPreviewPre?: string;
	responseBodyPreview?: string;
	responseBodyMediaUrlPre?: string;
	responseBodyMediaUrl?: string;
	requestBodySize?: number;
	responseBodySizePre?: number;
	responseBodySize?: number;
};

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

const readStreamBody = async (stream: ReadableStream): Promise<string> => {
	try {
		return await new Response(stream).text();
	} catch {
		return "";
	}
};

const readStreamBlob = async (stream: ReadableStream): Promise<Blob | null> => {
	try {
		return await new Response(stream).blob();
	} catch {
		return null;
	}
};

const ensureScramjetResponse = (response: any) => {
	if (!response) return response;
	const BareResponseCtor = (globalThis as any).$scramjet?.BareResponse;
	if (response instanceof Response && BareResponseCtor?.fromNativeResponse) {
		return BareResponseCtor.fromNativeResponse(response);
	}
	if (!Array.isArray(response.rawHeaders) && response.headers) {
		try {
			response.rawHeaders = [...response.headers.entries()];
		} catch {
			response.rawHeaders = [];
		}
	}
	return response;
};

const languageFromContentType = (contentType?: string | null) => {
	if (!contentType) return "plaintext";
	const normalized = contentType.toLowerCase();
	if (normalized.includes("application/json")) return "json";
	if (normalized.includes("text/html")) return "html";
	if (normalized.includes("text/css")) return "css";
	if (normalized.includes("javascript")) return "javascript";
	if (normalized.includes("xml")) return "xml";
	if (normalized.includes("text/plain")) return "plaintext";
	return "plaintext";
};
const getHeaderValue = (
	headers: Array<[string, string]> | undefined,
	name: string
) => {
	if (!headers) return undefined;
	const match = headers.find(
		([key]) => key.toLowerCase() === name.toLowerCase()
	);
	return match ? match[1] : undefined;
};

const isMediaContentType = (contentType?: string | null) =>
	!!contentType &&
	(contentType.toLowerCase().startsWith("image/") ||
		contentType.toLowerCase().startsWith("video/"));

const getMediaUrlFromBody = (
	body: unknown,
	contentType?: string | null
): { url?: string; size?: number } => {
	if (!isMediaContentType(contentType) || body == null) return {};
	if (body instanceof Blob) {
		return { url: URL.createObjectURL(body), size: body.size };
	}
	if (body instanceof ArrayBuffer) {
		const blob = new Blob([body], { type: contentType ?? "" });
		return { url: URL.createObjectURL(blob), size: blob.size };
	}
	return {};
};

export const RequestViewer: Component<
	{
		frame: any;
		active?: boolean;
		requests: RequestEntry[];
		selectedId: string | null;
		maxRequests: number;
		onSelect?: (id: string) => void;
		onClear?: () => void;
		onRequestsChange?: (
			updater: (prev: RequestEntry[]) => RequestEntry[]
		) => void;
		onSelectedChange?: (id: string | null) => void;
	},
	{
		search: string;
		responseHeadersView: "pre" | "post";
		requestHeadersView: "pre" | "post";
		responseBodyView: "pre" | "post";
		pluginReady: boolean;
		requestSeq: number;
		requestIdByRequest: WeakMap<object, string>;
		requestStartByRequest: WeakMap<object, number>;
		preResponseBodyStreamByRequest: WeakMap<object, ReadableStream>;
	},
	{}
> = function () {
	this.search ??= "";
	this.responseHeadersView ??= "post";
	this.requestHeadersView ??= "post";
	this.responseBodyView ??= "post";
	this.pluginReady ??= false;
	this.requestSeq ??= 0;
	this.requestIdByRequest ??= new WeakMap();
	this.requestStartByRequest ??= new WeakMap();
	this.preResponseBodyStreamByRequest ??= new WeakMap();

	if (!this.onSelectedChange && this.onSelect) {
		this.onSelectedChange = (id) => {
			if (id != null) this.onSelect?.(id);
		};
	}

	const initPlugin = (frame: any) => {
		if (this.pluginReady || !frame) return;
		this.pluginReady = true;
		const ScramjetPlugin = (globalThis as any).$scramjet.Plugin;
		const plugin = new ScramjetPlugin("demo-request-viewer");
		plugin.tap(frame.hooks.fetch.request, (context: any, props: any) => {
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

			this.onRequestsChange?.((prev) =>
				[entry, ...prev].slice(0, this.maxRequests)
			);
			if (!this.selectedId) {
				this.onSelectedChange?.(id);
			}
		});

		plugin.tap(
			frame.hooks.fetch.preresponse,
			async (context: any, props: any) => {
				const id = this.requestIdByRequest.get(context.request as object);
				if (!id) return;
				props.response = ensureScramjetResponse(props.response);
				const preHeaders = normalizeHeaders(
					(props.response as any)?.rawHeaders
				);
				const preContentType = getHeaderValue(preHeaders, "content-type");

				let preBodyInfo: { preview: string; size?: number } = {
					preview: "",
				};
				let preMediaUrl: string | undefined;
				if (
					props.response?.body &&
					typeof ReadableStream !== "undefined" &&
					props.response.body instanceof ReadableStream
				) {
					const [streamForResponse, streamForPreview] =
						props.response.body.tee();
					const [streamForStore, streamForRead] = streamForPreview.tee();
					if (props.response instanceof Response) {
						const rebuilt = new Response(streamForResponse, props.response);
						props.response = ensureScramjetResponse(rebuilt);
					} else {
						props.response.body = streamForResponse;
					}
					this.preResponseBodyStreamByRequest.set(
						context.request as object,
						streamForStore
					);
					if (isMediaContentType(preContentType)) {
						const blob = await readStreamBlob(streamForRead);
						if (blob) {
							preMediaUrl = URL.createObjectURL(blob);
							preBodyInfo = {
								preview: "",
								size: blob.size,
							};
						}
					} else {
						const previewText = await readStreamBody(streamForRead);
						preBodyInfo = getBodyPreview(previewText);
					}
				} else {
					const media = getMediaUrlFromBody(
						props.response?.body,
						preContentType
					);
					preMediaUrl = media.url;
					preBodyInfo = media.url
						? { preview: "", size: media.size }
						: getBodyPreview(props.response?.body);
				}

				this.onRequestsChange?.((prev) =>
					prev.map((entry) =>
						entry.id === id
							? {
									...entry,
									responseHeadersPre: preHeaders,
									responseBodyPreviewPre: preBodyInfo.preview,
									responseBodySizePre: preBodyInfo.size,
									responseBodyMediaUrlPre: preMediaUrl,
								}
							: entry
					)
				);
			}
		);

		plugin.tap(frame.hooks.fetch.response, async (context: any, props: any) => {
			const id = this.requestIdByRequest.get(context.request as object);
			if (!id) return;
			props.response = ensureScramjetResponse(props.response);
			const start = this.requestStartByRequest.get(context.request as object);
			const durationMs =
				start !== undefined
					? Math.max(0, Math.round(performance.now() - start))
					: undefined;
			const contentType = props.response.headers?.get?.("content-type");
			const respHeaders = normalizeHeaders(
				props.response.headers?.toRawHeaders?.() ??
					props.response.headers ??
					(props.response as any)?.rawHeaders
			);

			let respBodyInfo: { preview: string; size?: number } = {
				preview: "",
			};
			let respMediaUrl: string | undefined;
			if (
				props.response?.body &&
				typeof ReadableStream !== "undefined" &&
				props.response.body instanceof ReadableStream
			) {
				const [streamForResponse, streamForPreview] = props.response.body.tee();
				if (props.response instanceof Response) {
					const rebuilt = new Response(streamForResponse, props.response);
					props.response = ensureScramjetResponse(rebuilt);
				} else {
					props.response.body = streamForResponse;
				}
				if (isMediaContentType(contentType)) {
					const blob = await readStreamBlob(streamForPreview);
					if (blob) {
						respMediaUrl = URL.createObjectURL(blob);
						respBodyInfo = { preview: "", size: blob.size };
					}
				} else {
					const previewText = await readStreamBody(streamForPreview);
					respBodyInfo = getBodyPreview(previewText);
				}
			} else {
				const media = getMediaUrlFromBody(props.response?.body, contentType);
				respMediaUrl = media.url;
				respBodyInfo = media.url
					? { preview: "", size: media.size }
					: getBodyPreview(props.response.body);
			}

			this.onRequestsChange?.((prev) =>
				prev.map((entry) =>
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
								responseBodyMediaUrl: respMediaUrl,
							}
						: entry
				)
			);
		});
	};

	const activeSignal = use(this.active ?? false, this.frame).map(
		([active, frame]) => {
			if (active) initPlugin(frame);
			return active;
		}
	);

	return (
		<div class="requests-view">
			{activeSignal.map(() => null)}
			<div class="requests-header">
				<span>
					Recent requests (latest {use(this.maxRequests).map((max) => max)})
				</span>
				{this.onClear ? (
					<button class="tab-action" on:click={() => this.onClear?.()}>
						Clear
					</button>
				) : null}
			</div>
			<div class="requests-toolbar">
				<input
					class="requests-search"
					placeholder="Search requests"
					value={use(this.search)}
					on:input={(e: InputEvent) => {
						this.search = (e.target as HTMLInputElement).value;
					}}
				/>
			</div>
			<div class="requests-content">
				<div class="requests-list">
					{use(this.requests, this.search).map(([requests, search]) => {
						const query = search.trim().toLowerCase();
						const filtered = query
							? requests.filter((req) => {
									const haystack = [
										req.url,
										req.method,
										String(req.status ?? ""),
										req.contentType ?? "",
										req.destination ?? "",
										req.time,
									]
										.join(" ")
										.toLowerCase();
									return haystack.includes(query);
								})
							: requests;

						if (filtered.length === 0) {
							return (
								<div class="requests-empty">
									{requests.length === 0
										? "No requests captured yet."
										: "No requests match your search."}
								</div>
							);
						}

						return filtered.map((req) => (
							<RequestCard
								request={req}
								selected={use(this.selectedId).map(
									(selectedId) => selectedId === req.id
								)}
								onSelect={this.onSelect}
							/>
						));
					})}
				</div>
				<div class="requests-detail">
					{use(this.selectedId, this.requests).map(([selectedId, requests]) => {
						const selected = requests.find((req) => req.id === selectedId);
						if (!selected) {
							return (
								<div class="requests-empty">
									Select a request to see details.
								</div>
							);
						}

						return (
							<div class="detail-panel">
								<details class="detail-section" open>
									<summary>General</summary>
									<div class="detail-body">
										<div class="detail-meta-table">
											<div class="detail-meta-row">
												<span class="detail-meta-key">Request URL</span>
												<span class="detail-meta-value">{selected.url}</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Request Method</span>
												<span class="detail-meta-value">{selected.method}</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Status Code</span>
												<span class="detail-meta-value">
													{selected.status ?? "…"} {selected.statusText ?? ""}
												</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Duration</span>
												<span class="detail-meta-value">
													{selected.durationMs !== undefined
														? `${selected.durationMs}ms`
														: "…"}
												</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Destination</span>
												<span class="detail-meta-value">
													{selected.destination ?? "unknown"}
												</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Mode</span>
												<span class="detail-meta-value">
													{selected.mode ?? "unknown"}
												</span>
											</div>
											<div class="detail-meta-row">
												<span class="detail-meta-key">Content Type</span>
												<span class="detail-meta-value">
													{selected.contentType ?? "unknown"}
												</span>
											</div>
										</div>
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Response Headers</summary>
									<div class="detail-body">
										<div class="detail-toggle">
											<button
												class={use(this.responseHeadersView).map(
													(view) =>
														`toggle-button ${view === "post" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.responseHeadersView = "post";
												}}
											>
												Post-rewrite
											</button>
											<button
												class={use(this.responseHeadersView).map(
													(view) =>
														`toggle-button ${view === "pre" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.responseHeadersView = "pre";
												}}
											>
												Pre-rewrite
											</button>
										</div>
										<div class="detail-block">
											{use(this.responseHeadersView).map((view) => {
												const headers =
													view === "pre"
														? selected.responseHeadersPre
														: selected.responseHeaders;
												return (
													<div class="headers-table">
														{(headers ?? []).length === 0 ? (
															<div class="headers-empty">(none)</div>
														) : (
															headers?.map(([key, value]) => (
																<div class="header-row">
																	<span class="header-key">{key}</span>
																	<span class="header-value">{value}</span>
																</div>
															))
														)}
													</div>
												);
											})}
										</div>
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Request Headers</summary>
									<div class="detail-body">
										<div class="detail-toggle">
											<button
												class={use(this.requestHeadersView).map(
													(view) =>
														`toggle-button ${view === "post" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.requestHeadersView = "post";
												}}
											>
												Post-rewrite
											</button>
											<button
												class={use(this.requestHeadersView).map(
													(view) =>
														`toggle-button ${view === "pre" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.requestHeadersView = "pre";
												}}
											>
												Pre-rewrite
											</button>
										</div>
										<div class="detail-block">
											{use(this.requestHeadersView).map((view) => {
												const headers =
													view === "pre"
														? selected.requestHeadersPre
														: selected.requestHeaders;
												return (
													<div class="headers-table">
														{(headers ?? []).length === 0 ? (
															<div class="headers-empty">(none)</div>
														) : (
															headers?.map(([key, value]) => (
																<div class="header-row">
																	<span class="header-key">{key}</span>
																	<span class="header-value">{value}</span>
																</div>
															))
														)}
													</div>
												);
											})}
										</div>
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Response Body</summary>
									<div class="detail-body">
										<div class="detail-toggle">
											<button
												class={use(this.responseBodyView).map(
													(view) =>
														`toggle-button ${view === "post" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.responseBodyView = "post";
												}}
											>
												Post-rewrite
											</button>
											<button
												class={use(this.responseBodyView).map(
													(view) =>
														`toggle-button ${view === "pre" ? "active" : ""}`
												)}
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													this.responseBodyView = "pre";
												}}
											>
												Pre-rewrite
											</button>
										</div>
										{use(this.responseBodyView).map((view) => {
											const body =
												view === "pre"
													? selected.responseBodyPreviewPre
													: selected.responseBodyPreview;
											const mediaUrl =
												view === "pre"
													? selected.responseBodyMediaUrlPre
													: selected.responseBodyMediaUrl;
											const isMedia = isMediaContentType(selected.contentType);
											if (isMedia && mediaUrl) {
												if (
													selected.contentType
														?.toLowerCase()
														.startsWith("image/")
												) {
													return (
														<img
															src={mediaUrl}
															alt="Response preview"
															class="body-media"
														/>
													);
												}
												return (
													<video src={mediaUrl} class="body-media" controls />
												);
											}
											if (isMedia && !mediaUrl) {
												return (
													<div class="body-empty">(media not captured)</div>
												);
											}
											return body ? (
												<MonacoComponent
													value={body}
													language={languageFromContentType(
														selected.contentType
													)}
													readOnly={true}
													minHeight={320}
												/>
											) : (
												<div class="body-empty">(empty)</div>
											);
										})}
									</div>
								</details>
								{selected.requestBodyPreview ? (
									<details class="detail-section" open>
										<summary>Request Body</summary>
										<div class="detail-body">
											<MonacoComponent
												value={selected.requestBodyPreview}
												language={languageFromContentType(
													getHeaderValue(
														selected.requestHeaders,
														"content-type"
													)
												)}
												readOnly={true}
												minHeight={320}
											/>
										</div>
									</details>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};

RequestViewer.style = css`
	:scope {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.tab-action {
		border: 1px solid #333;
		background: #1f1f1f;
		color: #ddd;
		padding: 0.35em 0.75em;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.8em;
	}
	.requests-view {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: #0f0f0f;
		border: 1px solid #222;
		border-radius: 10px;
		padding: 0.75em;
		color: #e5e5e5;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			Roboto,
			"Helvetica Neue",
			Arial,
			sans-serif;
	}
	.requests-header {
		font-size: 0.9em;
		color: #aaa;
		margin-bottom: 0.5em;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.requests-toolbar {
		display: flex;
		gap: 0.5em;
		margin-bottom: 0.75em;
	}
	.requests-search {
		flex: 1;
		background: #121212;
		border: 1px solid #2a2a2a;
		color: #e5e7eb;
		padding: 0.45em 0.65em;
		border-radius: 8px;
		font-size: 0.85em;
	}
	.requests-search::placeholder {
		color: #6b7280;
	}
	.requests-content {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.75em;
		flex: 1;
		min-height: 0;
	}
	.requests-list {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}
	.requests-detail {
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		overflow: auto;
		background: #111;
		border: 1px solid #222;
		border-radius: 8px;
		padding: 0.75em;
	}
	.requests-empty {
		padding: 1em;
		border: 1px dashed #333;
		border-radius: 8px;
		text-align: center;
		color: #777;
	}
	.detail-panel {
		display: flex;
		flex-direction: column;
	}
	.detail-section {
		border-top: 1px solid #1f1f1f;
		padding: 0.65em 0;
	}
	.detail-section:first-of-type {
		border-top: none;
		padding-top: 0;
	}
	.detail-section summary {
		list-style: none;
		cursor: pointer;
		font-size: 0.95em;
		color: #f3f4f6;
		letter-spacing: 0.02em;
		display: flex;
		align-items: center;
		gap: 0.5em;
		user-select: none;
	}
	.detail-section summary::-webkit-details-marker {
		display: none;
	}
	.detail-section summary::before {
		content: "▸";
		color: #9ca3af;
		transition: transform 0.15s ease;
	}
	.detail-section[open] summary::before {
		transform: rotate(90deg);
	}
	.detail-body {
		margin-top: 0.5em;
	}
	.detail-toggle {
		display: flex;
		gap: 0.5em;
		margin-bottom: 0.5em;
		flex-wrap: wrap;
	}
	.toggle-button {
		border: 1px solid #2a2a2a;
		background: #121212;
		color: #9ca3af;
		padding: 0.25em 0.6em;
		border-radius: 6px;
		font-size: 0.75em;
		cursor: pointer;
	}
	.toggle-button.active {
		border-color: #60a5fa;
		color: #e5e7eb;
		background: rgba(96, 165, 250, 0.15);
	}
	.detail-meta-table {
		display: flex;
		flex-direction: column;
		gap: 0.35em;
		font-size: 0.8em;
		color: #d1d5db;
	}
	.detail-meta-row {
		display: grid;
		grid-template-columns: minmax(140px, 0.6fr) minmax(0, 1.4fr);
		gap: 0.75em;
		padding: 0.2em 0.1em;
		border-bottom: 1px dashed rgba(148, 163, 184, 0.15);
	}
	.detail-meta-row:last-child {
		border-bottom: none;
	}
	.detail-meta-key {
		color: #9ca3af;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.detail-meta-value {
		color: #e5e7eb;
		word-break: break-word;
	}
	.detail-block {
		background: #0b0b0b;
		border: 1px solid #1f1f1f;
		border-radius: 8px;
		padding: 0.6em 0.7em;
		margin-bottom: 0.6em;
	}
	.body-empty {
		color: #9ca3af;
		font-style: italic;
		padding: 0.4em 0.2em;
	}
	.body-media {
		max-width: 100%;
		max-height: 480px;
		border-radius: 8px;
		border: 1px solid #222;
		background: #0b0b0b;
		display: block;
	}
	.headers-table {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: 0.75em;
		color: #e5e7eb;
	}
	.header-row {
		display: grid;
		grid-template-columns: minmax(140px, 0.55fr) minmax(0, 1.45fr);
		gap: 0.6em;
		padding: 0.2em 0.1em;
		border-bottom: 1px dashed rgba(148, 163, 184, 0.18);
	}
	.header-row:last-child {
		border-bottom: none;
	}
	.header-key {
		color: #93c5fd;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
		font-size: 0.95em;
		word-break: break-all;
	}
	.header-value {
		color: #e5e7eb;
		word-break: break-word;
		line-height: 1.35;
	}
	.headers-empty {
		color: #9ca3af;
		font-style: italic;
	}
`;
