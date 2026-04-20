import { css, type Component } from "dreamland/core";
import {
	isHtmlMimeType,
	isImageMimeType,
	isJavascriptMimeType,
	isXmlMimeType,
	parseMimeType,
} from "@mercuryworkshop/scramjet";
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

const getResponseHeaders = (response: any): Array<[string, string]> => {
	if (!response) return [];
	if (Array.isArray(response.rawHeaders)) {
		return response.rawHeaders;
	}
	return normalizeHeaders(response.headers);
};

const languageFromContentType = (contentType?: string | null) => {
	if (!contentType) return "plaintext";
	const p = parseMimeType(contentType);
	if (!p) return "plaintext";
	if (p.essence === "application/json") return "json";
	if (isHtmlMimeType(p)) return "html";
	if (p.essence === "text/css") return "css";
	if (isJavascriptMimeType(p)) return "javascript";
	if (isXmlMimeType(p)) return "xml";
	if (p.essence === "text/plain") return "plaintext";
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

const isMediaContentType = (contentType?: string | null) => {
	if (!contentType) return false;
	const p = parseMimeType(contentType);
	if (!p) return false;
	const t = p.type.toLowerCase();
	return isImageMimeType(p) || t === "video";
};

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

const LARGE_BODY_BYTES = 50 * 1024;
const LARGE_BODY_PREVIEW_CHARS = 12000;

const getTextByteLength = (value: string): number =>
	new TextEncoder().encode(value).byteLength;

const truncateLargeBodyPreview = (value: string): string =>
	value.length <= LARGE_BODY_PREVIEW_CHARS
		? value
		: value.slice(0, LARGE_BODY_PREVIEW_CHARS);

const StableBodyViewer: Component<
	{
		value: string;
		language?: string;
		emptyMessage: string;
		mediaUrl?: string;
		mediaKind?: "none" | "image" | "video";
	},
	{
		expanded: boolean;
		lastValue: string;
	},
	{}
> = function () {
	this.expanded ??= false;
	this.lastValue ??= this.value ?? "";

	const value = use(this.value);
	const mediaUrl = use(this.mediaUrl);
	const mediaKind = use(this.mediaKind);
	const expanded = use(this.expanded);

	const mode = value
		.zip(mediaUrl, mediaKind)
		.map(([value, mediaUrl, mediaKind]) => {
			const kind = mediaKind ?? "none";
			if (kind === "image" && mediaUrl) return "image";
			if (kind === "video" && mediaUrl) return "video";
			if (value) return "code";
			return "empty";
		});
	const bodyBytes = value.map((value) => getTextByteLength(value ?? ""));
	const largeText = mode
		.zip(bodyBytes)
		.map(
			([mode, bodyBytes]) => mode === "code" && bodyBytes > LARGE_BODY_BYTES
		);
	const previewValue = value.map((value) =>
		truncateLargeBodyPreview(value ?? "")
	);
	const loadedFullText = largeText
		.zip(expanded)
		.map(([largeText, expanded]) => !largeText || expanded);
	const previewSummary = bodyBytes.zip(value).map(([bodyBytes, value]) => {
		const shownChars = Math.min((value ?? "").length, LARGE_BODY_PREVIEW_CHARS);
		return `Large body (${Math.round(bodyBytes / 1024)} KB). Showing the first ${shownChars.toLocaleString()} characters.`;
	});

	value.listen((value) => {
		if (this.lastValue !== value) {
			this.lastValue = value;
			this.expanded = false;
		}
	});

	return (
		<div class="body-viewer">
			<div
				class={mode.map(
					(mode) => `body-empty ${mode === "empty" ? "" : "hidden"}`
				)}
			>
				{use(this.emptyMessage)}
			</div>
			<img
				class={mode.map(
					(mode) => `body-media ${mode === "image" ? "" : "hidden"}`
				)}
				src={mediaUrl}
				alt="Response preview"
			/>
			<video
				class={mode.map(
					(mode) => `body-media ${mode === "video" ? "" : "hidden"}`
				)}
				src={mediaUrl}
				controls
			/>
			<div
				class={mode.map(
					(mode) => `body-editor ${mode === "code" ? "" : "hidden"}`
				)}
			>
				<div
					class={largeText.map(
						(largeText) => `body-large-preview ${largeText ? "" : "hidden"}`
					)}
				>
					<div class="body-large-meta">{previewSummary}</div>
					<pre class="body-large-text">{previewValue}</pre>
					<button
						class={loadedFullText.map(
							(loaded) => `body-load-button ${loaded ? "hidden" : ""}`
						)}
						on:click={() => {
							this.expanded = true;
						}}
					>
						Load full contents
					</button>
				</div>
				<div
					class={mode
						.zip(loadedFullText)
						.map(
							([mode, loaded]) =>
								`body-monaco ${mode === "code" && loaded ? "" : "hidden"}`
						)}
				>
					<MonacoComponent
						value={value}
						language={use(this.language).map(
							(language) => language ?? "plaintext"
						)}
						readOnly={true}
						minHeight={320}
					/>
				</div>
			</div>
		</div>
	);
};

StableBodyViewer.style = css`
	:scope {
		display: block;
	}
	.body-viewer {
		min-height: 320px;
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
	.body-editor {
		min-height: 320px;
	}
	.body-editor.hidden,
	.body-media.hidden,
	.body-empty.hidden {
		display: none;
	}
	.body-monaco.hidden,
	.body-large-preview.hidden,
	.body-load-button.hidden {
		display: none;
	}
	.body-large-preview {
		display: flex;
		flex-direction: column;
		gap: 0.65em;
	}
	.body-large-meta {
		color: #9ca3af;
		font-size: 0.78em;
	}
	.body-large-text {
		margin: 0;
		padding: 0.8em;
		max-height: 420px;
		overflow: auto;
		border: 1px solid #222;
		border-radius: 8px;
		background: #0b0b0b;
		color: #e5e7eb;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
		font-size: 0.78em;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.body-load-button {
		align-self: flex-start;
		border: 1px solid #2a2a2a;
		background: #121212;
		color: #e5e7eb;
		padding: 0.45em 0.7em;
		border-radius: 6px;
		font-size: 0.78em;
		cursor: pointer;
	}
	.body-load-button:hover {
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.12);
	}
`;

const HeadersTable: Component<
	{
		headers?: Array<[string, string]>;
	},
	{},
	{}
> = function () {
	return (
		<div class="headers-table">
			{use(this.headers).map((headers) =>
				(headers ?? []).length === 0 ? (
					<div class="headers-empty">(none)</div>
				) : (
					(headers ?? []).map(([key, value]) => (
						<div class="header-row">
							<span class="header-key">{key}</span>
							<span class="header-value">{value}</span>
						</div>
					))
				)
			)}
		</div>
	);
};

HeadersTable.style = css`
	:scope {
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
		captureStreamBodies: boolean;
		selectedRequest: RequestEntry | null;
		responseHeadersView: "pre" | "post";
		requestHeadersView: "pre" | "post";
		responseBodyView: "pre" | "post";
		pluginReady: boolean;
		requestSeq: number;
		listEl?: HTMLDivElement;
		pendingListRestore?: number;
		listAnchor?: {
			id: string | null;
			offset: number;
			stickToBottom: boolean;
		} | null;
		pendingRequestsFlush?: number;
		pendingRequestsUpdater?: ((prev: RequestEntry[]) => RequestEntry[]) | null;
		requestIdByRequest: WeakMap<object, string>;
		requestStartByRequest: WeakMap<object, number>;
	},
	{}
> = function () {
	this.search ??= "";
	this.captureStreamBodies ??= false;
	this.selectedRequest ??= null;
	this.responseHeadersView ??= "post";
	this.requestHeadersView ??= "post";
	this.responseBodyView ??= "post";
	this.pluginReady ??= false;
	this.requestSeq ??= 0;
	this.pendingListRestore ??= undefined;
	this.listAnchor ??= null;
	this.pendingRequestsFlush ??= undefined;
	this.pendingRequestsUpdater ??= null;
	this.requestIdByRequest ??= new WeakMap();
	this.requestStartByRequest ??= new WeakMap();

	if (!this.onSelectedChange && this.onSelect) {
		this.onSelectedChange = (id) => {
			if (id != null) this.onSelect?.(id);
		};
	}

	const isNearBottom = (el: HTMLElement) =>
		el.scrollHeight - el.clientHeight - el.scrollTop <= 8;

	const captureListAnchor = () => {
		const listEl = this.listEl;
		if (!listEl) return;

		const rows = Array.from(
			listEl.querySelectorAll<HTMLElement>("[data-request-id]")
		);
		const firstVisible =
			rows.find(
				(row) => row.offsetTop + row.offsetHeight > listEl.scrollTop + 1
			) ?? rows[0];

		this.listAnchor = {
			id: firstVisible?.dataset.requestId ?? null,
			offset: firstVisible ? firstVisible.offsetTop - listEl.scrollTop : 0,
			stickToBottom: isNearBottom(listEl),
		};
	};

	const restoreListAnchor = () => {
		if (this.pendingListRestore !== undefined) {
			cancelAnimationFrame(this.pendingListRestore);
		}

		this.pendingListRestore = requestAnimationFrame(() => {
			this.pendingListRestore = undefined;
			const listEl = this.listEl;
			const anchor = this.listAnchor;
			if (!listEl || !anchor) return;

			if (anchor.stickToBottom) {
				listEl.scrollTop = listEl.scrollHeight - listEl.clientHeight;
				this.listAnchor = null;
				return;
			}

			if (!anchor.id) {
				this.listAnchor = null;
				return;
			}

			const anchorEl = listEl.querySelector<HTMLElement>(
				`[data-request-id="${anchor.id}"]`
			);
			if (anchorEl) {
				listEl.scrollTop = anchorEl.offsetTop - anchor.offset;
			}
			this.listAnchor = null;
		});
	};

	const updateRequests = (
		updater: (prev: RequestEntry[]) => RequestEntry[]
	) => {
		const previousUpdater = this.pendingRequestsUpdater;
		this.pendingRequestsUpdater = previousUpdater
			? (prev) => updater(previousUpdater(prev))
			: updater;

		if (this.pendingRequestsFlush !== undefined) return;

		this.pendingRequestsFlush = requestAnimationFrame(() => {
			this.pendingRequestsFlush = undefined;
			const queuedUpdater = this.pendingRequestsUpdater;
			this.pendingRequestsUpdater = null;
			if (!queuedUpdater) return;

			captureListAnchor();
			this.onRequestsChange?.(queuedUpdater);
			restoreListAnchor();
		});
	};

	const shouldCaptureStreamBodies = () => this.captureStreamBodies !== false;
	const getRequestById = (id: string | null, requests: RequestEntry[]) =>
		id ? (requests.find((entry) => entry.id === id) ?? null) : null;

	use(this.selectedId, this.requests).listen(([selectedId, requests]) => {
		const nextSelected = getRequestById(selectedId, requests);
		if (this.selectedRequest !== nextSelected) {
			this.selectedRequest = nextSelected;
		}
	});

	const hasSelected = use(this.selectedRequest).map((selected) => !!selected);
	const selectedUrl = use(this.selectedRequest).map(
		(selected) => selected?.url ?? ""
	);
	const selectedMethod = use(this.selectedRequest).map(
		(selected) => selected?.method ?? ""
	);
	const selectedStatus = use(this.selectedRequest).map((selected) =>
		selected
			? `${selected.status ?? "…"} ${selected.statusText ?? ""}`.trim()
			: ""
	);
	const selectedDuration = use(this.selectedRequest).map((selected) =>
		selected?.durationMs !== undefined ? `${selected.durationMs}ms` : "…"
	);
	const selectedDestination = use(this.selectedRequest).map(
		(selected) => selected?.destination ?? "unknown"
	);
	const selectedMode = use(this.selectedRequest).map(
		(selected) => selected?.mode ?? "unknown"
	);
	const selectedContentType = use(this.selectedRequest).map(
		(selected) => selected?.contentType ?? "unknown"
	);
	const responseHeaders = use(
		this.selectedRequest,
		this.responseHeadersView
	).map(([selected, view]) =>
		!selected
			? []
			: view === "pre"
				? (selected.responseHeadersPre ?? [])
				: (selected.responseHeaders ?? [])
	);
	const requestHeaders = use(this.selectedRequest, this.requestHeadersView).map(
		([selected, view]) =>
			!selected
				? []
				: view === "pre"
					? (selected.requestHeadersPre ?? [])
					: (selected.requestHeaders ?? [])
	);
	const responseBodyValue = use(
		this.selectedRequest,
		this.responseBodyView
	).map(([selected, view]) =>
		!selected
			? ""
			: view === "pre"
				? (selected.responseBodyPreviewPre ?? "")
				: (selected.responseBodyPreview ?? "")
	);
	const responseBodyMediaUrl = use(
		this.selectedRequest,
		this.responseBodyView
	).map(([selected, view]) =>
		!selected
			? undefined
			: view === "pre"
				? selected.responseBodyMediaUrlPre
				: selected.responseBodyMediaUrl
	);
	const responseBodyLanguage = use(this.selectedRequest).map((selected) =>
		languageFromContentType(selected?.contentType)
	);
	const responseBodyIsMedia = use(this.selectedRequest).map(
		(selected) => !!selected && isMediaContentType(selected.contentType)
	);
	const responseBodyEmptyMessage = responseBodyIsMedia.map((isMedia) =>
		isMedia ? "(media not captured)" : "(empty)"
	);
	const responseBodyMediaKind = use(this.selectedRequest).map((selected) => {
		if (!selected || !isMediaContentType(selected.contentType)) return "none";
		return selected.contentType && isImageMimeType(selected.contentType)
			? "image"
			: "video";
	});
	const showRequestBody = use(this.selectedRequest).map(
		(selected) => !!selected?.requestBodyPreview
	);
	const requestBodyValue = use(this.selectedRequest).map(
		(selected) => selected?.requestBodyPreview ?? ""
	);
	const requestBodyLanguage = use(this.selectedRequest).map((selected) =>
		languageFromContentType(
			getHeaderValue(selected?.requestHeaders, "content-type")
		)
	);

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

			updateRequests((prev) => {
				const next = [...prev, entry].slice(-this.maxRequests);
				if (!this.selectedId) {
					this.selectedRequest = entry;
				}
				return next;
			});
			if (!this.selectedId) {
				this.onSelectedChange?.(id);
			}
		});

		plugin.tap(
			frame.hooks.fetch.preresponse,
			async (context: any, props: any) => {
				const id = this.requestIdByRequest.get(context.request as object);
				if (!id) return;
				const inspectedResponse = props.response;
				const preHeaders = getResponseHeaders(inspectedResponse);
				const preContentType = getHeaderValue(preHeaders, "content-type");

				let preBodyInfo: { preview: string; size?: number } = {
					preview: "",
				};
				let preMediaUrl: string | undefined;
				if (
					inspectedResponse?.body &&
					typeof ReadableStream !== "undefined" &&
					inspectedResponse.body instanceof ReadableStream
				) {
					preBodyInfo = {
						preview: shouldCaptureStreamBodies()
							? "(pre-rewrite stream preview unavailable)"
							: "(stream capture disabled)",
					};
				} else {
					const media = getMediaUrlFromBody(
						inspectedResponse?.body,
						preContentType
					);
					preMediaUrl = media.url;
					preBodyInfo = media.url
						? { preview: "", size: media.size }
						: getBodyPreview(inspectedResponse?.body);
					if (
						!shouldCaptureStreamBodies() &&
						typeof ReadableStream !== "undefined" &&
						inspectedResponse?.body instanceof ReadableStream
					) {
						preBodyInfo = {
							preview: "(stream capture disabled)",
						};
					}
				}

				updateRequests((prev) =>
					prev.map((entry) => {
						if (entry.id !== id) return entry;
						const nextEntry = {
							...entry,
							responseHeadersPre: preHeaders,
							responseBodyPreviewPre: preBodyInfo.preview,
							responseBodySizePre: preBodyInfo.size,
							responseBodyMediaUrlPre: preMediaUrl,
						};
						if (this.selectedId === id) {
							this.selectedRequest = nextEntry;
						}
						return nextEntry;
					})
				);
			}
		);

		plugin.tap(frame.hooks.fetch.response, async (context: any, props: any) => {
			const id = this.requestIdByRequest.get(context.request as object);
			if (!id) return;
			let inspectedResponse = props.response;
			const start = this.requestStartByRequest.get(context.request as object);
			const durationMs =
				start !== undefined
					? Math.max(0, Math.round(performance.now() - start))
					: undefined;
			const contentType = inspectedResponse?.headers?.get?.("content-type");
			const respHeaders = getResponseHeaders(inspectedResponse);

			let respBodyInfo: { preview: string; size?: number } = {
				preview: "",
			};
			let respMediaUrl: string | undefined;
			if (
				shouldCaptureStreamBodies() &&
				inspectedResponse?.body &&
				typeof ReadableStream !== "undefined" &&
				inspectedResponse.body instanceof ReadableStream
			) {
				const [streamForResponse, streamForPreview] =
					inspectedResponse.body.tee();
				if (inspectedResponse instanceof Response) {
					const rebuilt = new Response(streamForResponse, inspectedResponse);
					props.response = rebuilt;
					inspectedResponse = rebuilt;
				} else {
					props.response.body = streamForResponse;
					inspectedResponse = props.response;
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
				const media = getMediaUrlFromBody(inspectedResponse?.body, contentType);
				respMediaUrl = media.url;
				respBodyInfo = media.url
					? { preview: "", size: media.size }
					: getBodyPreview(inspectedResponse?.body);
				if (
					!shouldCaptureStreamBodies() &&
					typeof ReadableStream !== "undefined" &&
					inspectedResponse?.body instanceof ReadableStream
				) {
					respBodyInfo = {
						preview: "(stream capture disabled)",
					};
				}
			}

			updateRequests((prev) =>
				prev.map((entry) => {
					if (entry.id !== id) return entry;
					const nextEntry = {
						...entry,
						status: props.response.status,
						statusText: props.response.statusText,
						durationMs,
						contentType,
						responseHeaders: respHeaders,
						responseBodyPreview: respBodyInfo.preview,
						responseBodySize: respBodyInfo.size,
						responseBodyMediaUrl: respMediaUrl,
					};
					if (this.selectedId === id) {
						this.selectedRequest = nextEntry;
					}
					return nextEntry;
				})
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
					Requests, oldest to newest (latest{" "}
					{use(this.maxRequests).map((max) => max)})
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
				<label class="requests-toggle">
					<input
						type="checkbox"
						checked={use(this.captureStreamBodies)}
						on:change={(e: Event) => {
							this.captureStreamBodies = (e.target as HTMLInputElement).checked;
						}}
					/>
					<span>Capture post-rewrite stream bodies</span>
				</label>
			</div>
			<div class="requests-content">
				<div class="requests-list" this={use(this.listEl)}>
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
					<div
						class={hasSelected.map(
							(hasSelected) => `requests-empty ${hasSelected ? "hidden" : ""}`
						)}
					>
						Select a request to see details.
					</div>
					<div
						class={hasSelected.map(
							(hasSelected) => `detail-panel ${hasSelected ? "" : "hidden"}`
						)}
					>
						<details class="detail-section" open>
							<summary>General</summary>
							<div class="detail-body">
								<div class="detail-meta-table">
									<div class="detail-meta-row">
										<span class="detail-meta-key">Request URL</span>
										<span class="detail-meta-value">{selectedUrl}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Request Method</span>
										<span class="detail-meta-value">{selectedMethod}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Status Code</span>
										<span class="detail-meta-value">{selectedStatus}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Duration</span>
										<span class="detail-meta-value">{selectedDuration}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Destination</span>
										<span class="detail-meta-value">{selectedDestination}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Mode</span>
										<span class="detail-meta-value">{selectedMode}</span>
									</div>
									<div class="detail-meta-row">
										<span class="detail-meta-key">Content Type</span>
										<span class="detail-meta-value">{selectedContentType}</span>
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
									<HeadersTable headers={responseHeaders} />
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
									<HeadersTable headers={requestHeaders} />
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
								<StableBodyViewer
									value={responseBodyValue}
									language={responseBodyLanguage}
									emptyMessage={responseBodyEmptyMessage}
									mediaUrl={responseBodyMediaUrl}
									mediaKind={responseBodyMediaKind}
								/>
							</div>
						</details>
						{showRequestBody.map((showRequestBody) =>
							showRequestBody ? (
								<details class="detail-section" open>
									<summary>Request Body</summary>
									<div class="detail-body">
										<StableBodyViewer
											value={requestBodyValue}
											language={requestBodyLanguage}
											emptyMessage="(empty)"
											mediaKind="none"
										/>
									</div>
								</details>
							) : null
						)}
					</div>
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
		border-radius: 0;
		padding: 0.5em;
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
		font-size: 0.82em;
		color: #aaa;
		margin-bottom: 0.35em;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.requests-toolbar {
		display: flex;
		gap: 0.5em;
		margin-bottom: 0.45em;
		align-items: center;
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
	.requests-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		font-size: 0.8em;
		color: #cbd5e1;
		white-space: nowrap;
		user-select: none;
	}
	.requests-toggle input[type="checkbox"] {
		margin: 0;
	}
	.requests-content {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.5em;
		flex: 1;
		min-height: 0;
	}
	.requests-list {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.2em;
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
	.hidden {
		display: none !important;
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
	.body-viewer {
		min-height: 320px;
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
