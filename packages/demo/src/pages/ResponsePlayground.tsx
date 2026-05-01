import { css, type Component } from "dreamland/core";
import {
	isHtmlMimeType,
	isJavascriptMimeType,
	isXmlMimeType,
	parseMimeType,
	type ScramjetFetchRequest,
} from "@mercuryworkshop/scramjet";
const { ScramjetFetchHandler, ScramjetHeaders, BareResponse, rewriteUrl } =
	window.$scramjet;
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { controller } from "..";
import Monaco from "../components/Monaco";

const SIM_ORIGIN = "https://response-playground.local";

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

const normalizePath = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return "/index.html";
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const ResponsePlayground: Component<
	{
		active?: boolean;
	},
	{
		frame: Frame;
		requestPath: string;
		contentType: string;
		sourceBody: string;
		rewrittenBody: string;
		rewrittenContentType: string;
		status: string;
		hasRun: boolean;
	},
	{}
> = function (cx) {
	this.requestPath ??= "/index.html";
	this.contentType ??= "text/html; charset=utf-8";
	this.sourceBody ??= `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Response Playground</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; }
      h1 { color: #1f2937; }
    </style>
  </head>
  <body>
    <h1>Hello from simulated response</h1>
    <a href="/next">Relative link</a>
	<script>
		console.log(window.location)
	</script>
  </body>
</html>
`;
	this.rewrittenContentType ??= this.contentType;
	this.rewrittenBody ??= "";
	this.status ??= "Ready";
	this.hasRun ??= false;

	cx.mount = async () => {
		await controller.wait();
		this.frame = controller.createFrame();
	};

	const readBodyText = async (body: unknown): Promise<string> => {
		if (body == null) return "";
		if (typeof body === "string") return body;
		if (body instanceof ArrayBuffer) {
			return new TextDecoder().decode(new Uint8Array(body));
		}
		if (body instanceof Blob) {
			return await body.text();
		}
		if (
			typeof ReadableStream !== "undefined" &&
			body instanceof ReadableStream
		) {
			return await new Response(body).text();
		}
		return String(body);
	};

	const runSimulation = async (frame: Frame) => {
		if (!frame) return;
		const path = normalizePath(this.requestPath);
		this.requestPath = path;
		this.status = "Rewriting...";
		this.hasRun = true;

		try {
			const handler = new ScramjetFetchHandler({
				crossOriginIsolated: self.crossOriginIsolated,
				context: frame.context,
				transport: frame.controller.transport,
				async sendSetCookie() {},
				async fetchBlobUrl(url: string) {
					return BareResponse.fromNativeResponse(await fetch(url));
				},
				async fetchDataUrl(url: string) {
					return BareResponse.fromNativeResponse(await fetch(url));
				},
			});

			const originalFetch = handler.client.fetch.bind(handler.client);
			handler.client.fetch = async () =>
				BareResponse.fromNativeResponse(
					new Response(this.sourceBody, {
						status: 200,
						statusText: "OK",
						headers: {
							"content-type": this.contentType,
							"cache-control": "no-store",
						},
					})
				);

			const targetUrl = `${SIM_ORIGIN}${path}`;
			const encoded = rewriteUrl(targetUrl, frame.context, {
				//@ts-expect-error
				origin: new URL(location.href),
				//@ts-expect-error
				base: new URL(location.href),
			});

			const request = {
				rawUrl: new URL(encoded, location.href),
				rawClientUrl: new URL(location.href),
				rawReferrer: "",
				destination: "document",
				mode: "navigate",
				referrer: "",
				method: "GET",
				body: null,
				cache: "default",
				initialHeaders: new ScramjetHeaders(),
				clientId: frame.id,
			};

			const rewritten = await handler.handleFetch(
				request as ScramjetFetchRequest
			);
			handler.client.fetch = originalFetch;

			this.rewrittenBody = await readBodyText(rewritten.body);
			this.rewrittenContentType =
				rewritten.headers?.get?.("content-type") || this.contentType;
			this.status = "Done";
		} catch (error) {
			console.error("Response simulation failed", error);
			this.status = "Failed";
		}
	};

	const activeSignal = use(this.active ?? false, this.frame).map(
		([active, frame]) => {
			if (active && frame) {
				if (!this.hasRun) runSimulation(frame);
			}
			return active;
		}
	);

	return (
		<div class="response-playground">
			{activeSignal.map(() => null)}
			<div class="response-pane input-pane">
				<div class="section-title">Simulated Response</div>
				<div class="controls">
					<label>Path</label>
					<input
						type="text"
						value={use(this.requestPath)}
						spellcheck={false}
						on:input={(e: InputEvent) => {
							this.requestPath = (e.target as HTMLInputElement).value;
						}}
					/>
					<label>Content-Type</label>
					<input
						type="text"
						value={use(this.contentType)}
						spellcheck={false}
						on:input={(e: InputEvent) => {
							this.contentType = (e.target as HTMLInputElement).value;
						}}
					/>
					<button
						type="button"
						on:click={() => {
							runSimulation(this.frame);
						}}
					>
						Simulate Rewrite
					</button>
				</div>
				<div class="editor-wrap">
					<Monaco
						value={use(this.sourceBody)}
						language={use(this.contentType).map((ct) =>
							languageFromContentType(ct)
						)}
						readOnly={false}
						fill={true}
						onSave={() => runSimulation(this.frame)}
						onChange={(value) => {
							this.sourceBody = value;
						}}
					/>
				</div>
			</div>
			<div class="response-pane output-pane">
				<div class="section-title">Scramjet Rewritten Output</div>
				<div class="meta-row">
					<span>{use(this.status).map((x) => `Status: ${x}`)}</span>
					<span>
						{use(this.rewrittenContentType).map((x) =>
							x ? `Content-Type: ${x}` : ""
						)}
					</span>
				</div>
				<div class="editor-wrap">
					<Monaco
						value={use(this.rewrittenBody)}
						language={use(this.rewrittenContentType).map((ct) =>
							languageFromContentType(ct)
						)}
						readOnly={true}
						fill={true}
					/>
				</div>
			</div>
		</div>
	);
};

ResponsePlayground.style = css`
	:scope {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0;
		flex: 1;
		min-width: 0;
		min-height: 0;
		border: 1px solid #222;
		background: #0f0f0f;
	}
	.response-pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.output-pane {
		border-left: 1px solid #222;
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
	.controls {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		align-items: center;
		gap: 0.45em;
		padding: 0.55em 0.8em;
		border-bottom: 1px solid #222;
		background: #111;
	}
	.controls label {
		font-size: 0.78em;
		color: #aaa;
	}
	.controls input {
		min-width: 0;
		padding: 0.3em 0.45em;
		border: 1px solid #2a2a2a;
		background: #121212;
		color: #e5e7eb;
		font-size: 0.8em;
		border-radius: 1px;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
	}
	.controls button {
		grid-column: 1 / -1;
		justify-self: start;
		border: 1px solid #333;
		background: #1f1f1f;
		color: #ddd;
		border-radius: 0;
		padding: 0.34em 0.62em;
		cursor: pointer;
		font-size: 0.8em;
	}
	.controls button:hover {
		background: #2a2a2a;
		border-color: #444;
	}
	.meta-row {
		display: flex;
		justify-content: space-between;
		gap: 0.7em;
		padding: 0.45em 0.8em;
		border-bottom: 1px solid #222;
		background: #111;
		color: #9ca3af;
		font-size: 0.76em;
	}
	.editor-wrap {
		flex: 1;
		min-height: 0;
		min-width: 0;
	}
	@media (max-width: 1000px) {
		:scope {
			grid-template-columns: 1fr;
		}
		.output-pane {
			border-left: 0;
			border-top: 1px solid #222;
		}
	}
`;
export default ResponsePlayground;
