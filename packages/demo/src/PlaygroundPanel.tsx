import { css, type Component } from "dreamland/core";
import { MonacoComponent } from "./MonacoComponent";

const DEFAULT_ORIGIN = "https://fakeorigin.com";
const DEFAULT_PREVIEW_URL = `${DEFAULT_ORIGIN}/`;

type PlaygroundFile = {
	path: string;
	content: string;
};

const DEFAULT_FILES: PlaygroundFile[] = [
	{
		path: "/index.html",
		content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scramjet Playground</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main>
      <h1>Scramjet Playground</h1>
      <p>Edit files on the left, then reload the preview.</p>
      <button id="btn">Click me</button>
      <pre id="out"></pre>
    </main>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
	},
	{
		path: "/style.css",
		content: `:root {
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}
body {
  margin: 0;
  padding: 24px;
  background: #0b1220;
  color: #e5e7eb;
}
main {
  max-width: 720px;
}
button {
  background: #1d4ed8;
  border: 0;
  color: white;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
}
`,
	},
	{
		path: "/main.js",
		content: `const out = document.getElementById("out");
const button = document.getElementById("btn");
if (button && out) {
  button.addEventListener("click", () => {
    out.textContent = "Hello from fakeorigin assets served via Scramjet request hook.";
  });
}
`,
	},
];

const languageFromPath = (path: string) => {
	if (path.endsWith(".html")) return "html";
	if (path.endsWith(".css")) return "css";
	if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
	if (path.endsWith(".ts")) return "typescript";
	if (path.endsWith(".json")) return "json";
	return "plaintext";
};

const contentTypeFromPath = (path: string) => {
	if (path.endsWith(".html")) return "text/html; charset=utf-8";
	if (path.endsWith(".css")) return "text/css; charset=utf-8";
	if (path.endsWith(".js") || path.endsWith(".mjs"))
		return "text/javascript; charset=utf-8";
	if (path.endsWith(".json")) return "application/json; charset=utf-8";
	if (path.endsWith(".svg")) return "image/svg+xml";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	if (path.endsWith(".gif")) return "image/gif";
	if (path.endsWith(".ico")) return "image/x-icon";
	return "text/plain; charset=utf-8";
};

const normalizeOrigin = (value: string) => {
	const raw = value.trim();
	const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw)
		? raw
		: `https://${raw}`;
	const parsed = new URL(withProtocol);
	return parsed.origin;
};

const normalizePreviewUrl = (value: string, origin: string) => {
	const raw = value.trim();
	if (!raw) return `${origin}/`;
	return new URL(raw, `${origin}/`).href;
};

const normalizeFilePath = (input: string) => {
	let path = input.trim();
	if (!path) return "";
	if (!path.startsWith("/")) path = `/${path}`;
	return path;
};

const displayFilePath = (path: string) => path.replace(/^\//, "");

const requestPathToFilePath = (pathname: string) => {
	let path = decodeURIComponent(pathname || "/");
	if (path === "/" || path === "") {
		path = "/index.html";
	} else if (path.endsWith("/")) {
		path = `${path}index.html`;
	}
	return path;
};

export const PlaygroundPanel: Component<
	{
		frame: any;
		active?: boolean;
	},
	{
		pluginReady: boolean;
		origin: string;
		originInput: string;
		previewUrl: string;
		previewUrlInput: string;
		files: Record<string, string>;
		selectedFile: string;
		editorSplit: number;
		isResizing: boolean;
	},
	{}
> = function () {
	this.pluginReady ??= false;
	this.origin ??= DEFAULT_ORIGIN;
	this.originInput ??= DEFAULT_ORIGIN;
	this.previewUrl ??= DEFAULT_PREVIEW_URL;
	this.previewUrlInput ??= DEFAULT_PREVIEW_URL;
	this.selectedFile ??= "/index.html";
	this.editorSplit ??= 0.58;
	this.isResizing ??= false;
	this.files ??= Object.fromEntries(
		DEFAULT_FILES.map((file) => [file.path, file.content])
	);

	const clampSplit = (value: number) => Math.min(0.72, Math.max(0.38, value));

	const startResize = (event: MouseEvent) => {
		event.preventDefault();
		if (event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement | null;
		if (!handle) return;
		const container = handle.closest(".playground-view") as HTMLElement | null;
		if (!container) return;
		const styles = getComputedStyle(container);
		const paddingLeft = parseFloat(styles.paddingLeft || "0") || 0;
		const paddingRight = parseFloat(styles.paddingRight || "0") || 0;

		const toSplit = (clientX: number) => {
			const rect = container.getBoundingClientRect();
			const contentLeft = rect.left + paddingLeft;
			const contentWidth = rect.width - paddingLeft - paddingRight;
			if (contentWidth <= 0) return this.editorSplit;
			const editorPx = clientX - contentLeft;
			return clampSplit(editorPx / contentWidth);
		};
		this.isResizing = true;
		const previousUserSelect = document.body.style.userSelect;
		document.body.style.userSelect = "none";
		const startSplit = toSplit(event.clientX);
		this.editorSplit = startSplit;
		container.style.setProperty(
			"--editor-pct",
			`${(startSplit * 100).toFixed(2)}%`
		);

		const onMove = (moveEvent: MouseEvent) => {
			const split = toSplit(moveEvent.clientX);
			this.editorSplit = split;
			container.style.setProperty(
				"--editor-pct",
				`${(split * 100).toFixed(2)}%`
			);
		};

		const onUp = () => {
			this.isResizing = false;
			globalThis.removeEventListener("mousemove", onMove);
			globalThis.removeEventListener("mouseup", onUp);
			document.body.style.userSelect = previousUserSelect;
		};

		globalThis.addEventListener("mousemove", onMove);
		globalThis.addEventListener("mouseup", onUp);
	};

	const ensurePlugin = (frame: any) => {
		if (!frame || this.pluginReady) return;
		this.pluginReady = true;

		const Plugin = (globalThis as any).$scramjet?.Plugin;
		if (!Plugin) return;

		const plugin = new Plugin("demo-playground");
		plugin.tap(frame.hooks.fetch.request, (context: any, props: any) => {
			if (!context?.parsed?.url) return;
			if (
				context.request?.method !== "GET" &&
				context.request?.method !== "HEAD"
			)
				return;
			if (context.parsed.url.origin !== this.origin) return;

			const filePath = requestPathToFilePath(context.parsed.url.pathname);
			const body = this.files[filePath];
			if (body == null) {
				props.earlyResponse = new Response(
					`Not Found: ${filePath}\n\nAvailable files:\n${Object.keys(this.files)
						.sort()
						.join("\n")}`,
					{
						status: 404,
						statusText: "Not Found",
						headers: {
							"content-type": "text/plain; charset=utf-8",
							"cache-control": "no-store",
						},
					}
				);
				return;
			}

			props.earlyResponse = new Response(
				context.request.method === "HEAD" ? null : body,
				{
					status: 200,
					statusText: "OK",
					headers: {
						"content-type": contentTypeFromPath(filePath),
						"cache-control": "no-store",
					},
				}
			);
		});
	};

	const goPreview = (frame: any, targetUrl?: string) => {
		if (!frame) return;
		try {
			const normalized = normalizePreviewUrl(
				targetUrl ?? this.previewUrlInput,
				this.origin
			);
			this.previewUrl = normalized;
			this.previewUrlInput = normalized;
			frame.go(normalized);
		} catch (error) {
			console.error("Invalid preview URL", error);
		}
	};

	const activeSignal = use(this.active ?? false, this.frame).map(
		([active, frame]) => {
			if (active && frame) {
				ensurePlugin(frame);
				if (!frame.element.src) {
					goPreview(frame, this.previewUrl);
				}
			}
			return active;
		}
	);

	return (
		<div
			class={use(this.isResizing).map((dragging) =>
				dragging ? "playground-view resizing" : "playground-view"
			)}
			style={`--editor-pct: ${(this.editorSplit * 100).toFixed(2)}%;`}
		>
			{activeSignal.map(() => null)}
			<div class="editor-column">
				<div class="section-title">Files</div>
				<div class="editor-layout">
					<div class="file-tree">
						{use(this.files, this.selectedFile).map(([files, selected]) =>
							Object.keys(files)
								.sort()
								.map((path) => (
									<div
										class={`file-item-row ${selected === path ? "active" : ""}`}
									>
										<button
											class="file-item"
											on:click={() => {
												this.selectedFile = path;
											}}
										>
											{displayFilePath(path)}
										</button>
										<div class="file-item-actions">
											<button
												type="button"
												class="file-item-action rename"
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													const next = normalizeFilePath(
														prompt("Rename file", path) || ""
													);
													if (!next || next === path || next in this.files)
														return;
													const value = this.files[path];
													if (value == null) return;
													const rest = { ...this.files };
													delete rest[path];
													this.files = { ...rest, [next]: value };
													if (this.selectedFile === path)
														this.selectedFile = next;
												}}
												title="Rename file"
											>
												<span class="material-symbols-outlined">edit</span>
											</button>
											<button
												type="button"
												class="file-item-action delete"
												on:click={(e: MouseEvent) => {
													e.preventDefault();
													e.stopPropagation();
													const paths = Object.keys(this.files).sort();
													if (paths.length <= 1) return;
													const rest = { ...this.files };
													delete rest[path];
													this.files = rest;
													if (this.selectedFile === path) {
														const remaining = Object.keys(rest).sort();
														this.selectedFile = remaining[0] ?? "/index.html";
													}
												}}
												title="Delete file"
											>
												<span class="material-symbols-outlined">delete</span>
											</button>
										</div>
									</div>
								))
						)}
						<button
							class="file-item file-new"
							on:click={() => {
								const next = normalizeFilePath(
									prompt("New file path", "/new-file.txt") || ""
								);
								if (!next) return;
								if (!(next in this.files)) {
									this.files = {
										...this.files,
										[next]: "",
									};
								}
								this.selectedFile = next;
							}}
						>
							+ New file
						</button>
					</div>
					<div class="editor-pane">
						<div class="editor-header">{use(this.selectedFile)}</div>
						<MonacoComponent
							value={use(this.selectedFile, this.files).map(
								([selected, files]) => files[selected] ?? ""
							)}
							language={use(this.selectedFile).map((selected) =>
								languageFromPath(selected)
							)}
							readOnly={false}
							fill={true}
							onSave={() => {
								goPreview(this.frame, this.previewUrl);
							}}
							onChange={(value) => {
								const selected = this.selectedFile;
								if (!(selected in this.files)) return;
								this.files = {
									...this.files,
									[selected]: value,
								};
							}}
						/>
					</div>
				</div>
			</div>
			<div class="split-handle" on:mousedown={startResize} />
			<div class="preview-column">
				<div class="section-title">Preview</div>
				<form
					class="preview-omnibox"
					on:submit={(e: SubmitEvent) => {
						e.preventDefault();
						goPreview(this.frame);
					}}
				>
					<div class="omnibox-shell">
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
									goPreview(this.frame, this.previewUrl);
								}}
							>
								<span class="material-symbols-outlined">refresh</span>
							</button>
						</div>
						<input
							type="text"
							value={use(this.previewUrlInput)}
							spellcheck={false}
							on:input={(e: InputEvent) => {
								this.previewUrlInput = (e.target as HTMLInputElement).value;
							}}
							placeholder="Enter URL or search..."
						/>
					</div>
				</form>
				<div class="preview-frame">
					{use(this.frame).map((f) => f?.element)}
				</div>
				<form
					class="origin-bar"
					on:submit={(e: SubmitEvent) => {
						e.preventDefault();
						try {
							const nextOrigin = normalizeOrigin(this.originInput);
							this.origin = nextOrigin;
							const nextUrl = `${nextOrigin}/`;
							this.previewUrl = nextUrl;
							this.previewUrlInput = nextUrl;
							goPreview(this.frame, nextUrl);
						} catch (error) {
							console.error("Invalid fake origin", error);
						}
					}}
				>
					<div class="origin-shell">
						<span class="origin-prefix">Fake origin</span>
						<input
							type="text"
							value={use(this.originInput)}
							spellcheck={false}
							on:input={(e: InputEvent) => {
								this.originInput = (e.target as HTMLInputElement).value;
							}}
							placeholder="https://fakeorigin.com"
						/>
					</div>
				</form>
			</div>
		</div>
	);
};

PlaygroundPanel.style = css`
	@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0");

	:scope {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		padding: 0;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			Roboto,
			"Helvetica Neue",
			Arial,
			sans-serif;
		color: #e5e5e5;
	}
	.material-symbols-outlined {
		font-family: "Material Symbols Outlined";
		font-weight: normal;
		font-style: normal;
		font-size: 16px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}
	.playground-view {
		display: flex;
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		gap: 0;
		overflow: hidden;
		padding: 0;
		border-radius: 10px;
		border: 1px solid #222;
		background: #0f0f0f;
		position: relative;
	}
	.playground-view.resizing {
		cursor: col-resize;
	}
	.playground-view.resizing iframe {
		pointer-events: none;
	}
	.split-handle {
		width: 9px;
		flex: 0 0 auto;
		margin: 0;
		border-radius: 0;
		background: transparent;
		cursor: col-resize;
		touch-action: none;
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--editor-pct, 58%) - 4.5px);
		z-index: 3;
	}
	.split-handle::before {
		content: "";
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		transform: translateX(-50%);
		background: #2a2a2a;
		pointer-events: none;
	}
	.split-handle:hover {
		background: transparent;
	}
	.split-handle:hover::before {
		background: #4a4a4a;
	}
	.editor-column,
	.preview-column {
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		box-shadow: none;
	}
	.editor-column {
		flex: 0 0 var(--editor-pct, 58%);
		gap: 0;
	}
	.preview-column {
		flex: 1 1 0;
		gap: 0;
		border-left: 0;
	}
	.section-title {
		color: #aaa;
		font-size: 0.72em;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 600;
		padding: 0.7em 0.9em;
		border-bottom: 1px solid #222;
		background: #111;
	}
	.editor-layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		flex: 1;
		min-width: 0;
		min-height: 0;
		gap: 0;
	}
	.file-tree {
		border-right: 1px solid #222;
		border-radius: 0;
		background: #111;
		padding: 0.35em 0.3em;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.15em;
	}
	.file-item {
		flex: 1;
		min-width: 0;
		text-align: left;
		background: transparent;
		color: #d1d5db;
		border: 0;
		border-radius: 4px;
		padding: 0.35em 0.55em;
		font-size: 0.8em;
		font-family: inherit;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}
	.file-item-row {
		display: flex;
		align-items: center;
		gap: 0.3em;
		border-radius: 4px;
		padding-right: 0.2em;
	}
	.file-item-row:hover {
		background: #171717;
	}
	.file-item-row:hover .file-item {
		color: #ffffff;
	}
	.file-item-row.active {
		background: #1f1f1f;
		position: relative;
	}
	.file-item-row.active .file-item {
		color: #fff;
	}
	.file-item-row.active::before {
		content: "";
		position: absolute;
		left: 0;
		top: 3px;
		bottom: 3px;
		width: 2px;
		background: #6b7280;
		border-radius: 999px;
	}
	.file-item-actions {
		display: flex;
		align-items: center;
		gap: 0.2em;
		opacity: 0;
		transition: opacity 120ms ease;
	}
	.file-item-actions:hover,
	.file-item-actions:focus-within {
		opacity: 1;
	}
	.file-item-action {
		border: 0;
		background: transparent;
		color: #9ca3af;
		padding: 0.16em;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.file-item-action.rename {
		color: #78b879;
	}
	.file-item-action.delete {
		color: #c87b7b;
	}
	.file-item-action .material-symbols-outlined {
		font-size: 14px;
	}
	.file-item-action:hover {
		background: #2a2a2a;
		filter: brightness(1.1);
	}
	.file-item.file-new {
		flex: 0 0 auto;
		margin-top: 0.25em;
		color: #d1d5db;
		width: 100%;
	}
	.editor-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border: 0;
		border-radius: 0;
		padding: 0;
		background: #111;
		gap: 0;
	}
	.editor-header {
		color: #9ca3af;
		font-size: 0.8em;
		font-family: inherit;
		padding: 0.6em 0.8em;
		border-bottom: 1px solid #222;
		background: #111;
	}
	.origin-bar {
		display: flex;
		align-items: center;
		gap: 0.45em;
		padding: 0.45em 0.5em;
		border-top: 1px solid #222;
		background: #0f0f0f;
	}
	.origin-shell {
		display: flex;
		align-items: center;
		gap: 0.45em;
		flex: 1;
		min-width: 0;
		border: 1px solid #2a2a2a;
		background: #121212;
		border-radius: 3px;
		padding: 0.22em 0.42em;
	}
	.origin-prefix {
		color: #8f8f8f;
		font-size: 0.74em;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.origin-bar input {
		min-width: 0;
		width: 100%;
		padding: 0.2em 0.15em;
		border: 1px solid transparent;
		border-radius: 1px;
		background: transparent;
		color: #e5e7eb;
		font-size: 0.82em;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
	}
	.origin-bar input:focus {
		outline: none;
		border-color: #7a7a7a;
		box-shadow: inset 0 0 0 1px #7a7a7a;
	}
	.preview-omnibox {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 0.4em 0.5em;
		border-bottom: 1px solid #222;
		background: #0f0f0f;
	}
	.omnibox-shell {
		display: flex;
		align-items: center;
		gap: 0.35em;
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		border-radius: 0;
		padding: 0;
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
		width: 1.45em;
		height: 1.45em;
		padding: 0;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nav-btn .material-symbols-outlined {
		font-size: 15px;
	}
	.nav-btn:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.preview-omnibox input {
		min-width: 0;
		width: 100%;
		padding: 0.22em 0.18em;
		border: 1px solid transparent;
		border-radius: 1px;
		background: transparent;
		color: #e5e7eb;
	}
	.preview-omnibox input:focus {
		outline: none;
		border-color: #7a7a7a;
		box-shadow: inset 0 0 0 1px #7a7a7a;
	}
	.preview-frame {
		flex: 1;
		min-width: 0;
		min-height: 0;
		border: 0;
		border-radius: 0;
		overflow: hidden;
		background: #fff;
		display: flex;
	}
	iframe {
		border: 0;
		width: 100%;
		height: 100%;
	}
	@media (max-width: 1120px) {
		.playground-view {
			flex-direction: column;
		}
		.split-handle {
			display: none;
		}
		.preview-frame {
			min-height: 320px;
		}
	}
	@media (max-width: 760px) {
		:scope {
			padding: 0;
		}
		.editor-layout {
			grid-template-columns: 1fr;
		}
		.file-tree {
			flex-direction: row;
			align-items: center;
			overflow-x: auto;
			min-height: 0;
		}
		.file-item {
			width: auto;
			flex: 0 0 auto;
		}
		.preview-omnibox {
			padding: 0.4em;
		}
		.origin-bar {
			flex-direction: column;
			align-items: stretch;
		}
	}
`;
