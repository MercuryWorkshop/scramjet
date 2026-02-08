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
	requestHeaders?: Array<[string, string]>;
	responseHeaders?: Array<[string, string]>;
	requestBodyPreview?: string;
	responseBodyPreview?: string;
	requestBodySize?: number;
	responseBodySize?: number;
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

export const RequestViewer: Component<
	{
		requests: RequestEntry[];
		selectedId: string | null;
		maxRequests: number;
		onSelect?: (id: string) => void;
		onClear?: () => void;
	},
	{
		search: string;
	},
	{}
> = function () {
	this.search ??= "";

	return (
		<div class="requests-view">
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
										<div class="detail-block">
											<div class="headers-table">
												{(selected.responseHeaders ?? []).length === 0 ? (
													<div class="headers-empty">(none)</div>
												) : (
													selected.responseHeaders?.map(([key, value]) => (
														<div class="header-row">
															<span class="header-key">{key}</span>
															<span class="header-value">{value}</span>
														</div>
													))
												)}
											</div>
										</div>
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Request Headers</summary>
									<div class="detail-body">
										<div class="detail-block">
											<div class="headers-table">
												{(selected.requestHeaders ?? []).length === 0 ? (
													<div class="headers-empty">(none)</div>
												) : (
													selected.requestHeaders?.map(([key, value]) => (
														<div class="header-row">
															<span class="header-key">{key}</span>
															<span class="header-value">{value}</span>
														</div>
													))
												)}
											</div>
										</div>
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Response Body</summary>
									<div class="detail-body">
										{selected.responseBodyPreview ? (
											<MonacoComponent
												value={selected.responseBodyPreview}
												language={languageFromContentType(selected.contentType)}
												readOnly={true}
												minHeight={320}
											/>
										) : (
											<div class="body-empty">(empty)</div>
										)}
									</div>
								</details>
								<details class="detail-section" open>
									<summary>Request Body</summary>
									<div class="detail-body">
										{selected.requestBodyPreview ? (
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
										) : (
											<div class="body-empty">(empty)</div>
										)}
									</div>
								</details>
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
