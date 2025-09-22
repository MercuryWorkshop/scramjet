import { html } from "dreamland/js-runtime";
import { css } from "dreamland/core";
import { editor } from "monaco-editor";
import "./style.css";

import {
	setConfig,
	ScramjetClient,
	rewriteJs,
	asyncSetWasm,
} from "@mercuryworkshop/scramjet/bundled";
setConfig({
	wisp: "ws://localhost",
	prefix: "/scramjet/",
	globals: {
		wrapfn: "$scramjet$wrap",
		wrappropertybase: "$scramjet__",
		wrappropertyfn: "$scramjet$prop",
		cleanrestfn: "$scramjet$clean",
		importfn: "$scramjet$import",
		rewritefn: "$scramjet$rewrite",
		metafn: "$scramjet$meta",
		setrealmfn: "$scramjet$setrealm",
		pushsourcemapfn: "$scramjet$pushsourcemap",
		trysetfn: "$scramjet$tryset",
		templocid: "$scramjet$temploc",
		tempunusedid: "$scramjet$tempunused",
	},
	files: {
		wasm: "/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		serviceworkers: false,
		syncxhr: false,
		strictRewrites: true,
		rewriterLogs: false,
		captureErrors: true,
		cleanErrors: false,
		scramitize: false,
		sourcemaps: true,
		destructureRewrites: true,
		interceptDownloads: false,
		allowInvalidJs: false,
		allowFailedIntercepts: false,
		antiAntiDebugger: false,
	},
	siteFlags: {},
	codec: {
		encode: (url) => {
			if (!url) return url;

			return encodeURIComponent(url);
		},
		decode: (url) => {
			if (!url) return url;

			return decodeURIComponent(url);
		},
	},
});
self.MonacoEnvironment = {
	getWorkerUrl: function (workerId, label) {
		return "data:application/javascript,";
	},
};

function Editor(cx) {
	cx.mount = () => {
		this.editor = editor.create(cx.root, {
			language: this.language,
			automaticLayout: true,
			value: localStorage["code"],
			theme: "vs-dark",
		});
		setTimeout(() => this.recompile(this.editor.getValue()), 1000);
		this.editor
			.getModel()
			.onDidChangeContent(() => this.recompile(this.editor.getValue()));
	};

	return html`<div />`;
}
Editor.style = css`
	:scope {
		width: 100%;
		height: 100%;
	}
`;

let ifr = html`<iframe style="display: none" />`;
document.body.append(ifr);
const cl = new ScramjetClient(ifr.contentWindow);
Object.defineProperty(cl.meta, "base", {
	get() {
		return new URL("https://example.com/");
	},
});
Object.defineProperty(cl.meta, "origin", {
	get() {
		return new URL("https://example.com/");
	},
});
const getter = Object.getOwnPropertyDescriptor(cl.__proto__, "url");
Object.defineProperty(cl, "url", {
	get() {
		return new URL("https://example.com/");
	},
	set: getter.set,
});

cl.hook();

function App() {
	let t = this;
	cl.Proxy(["console.log", "console.warn", "console.debug", "console.info"], {
		apply(ctx) {
			t.output += ctx.args.join("\n");
		},
	});
	cl.Proxy("console.error", {
		apply(ctx) {
			t.errors += ctx.args.join("\n");
		},
	});

	const run = (js) => {
		this.errors = "";
		this.output = "";
		try {
			ifr.contentWindow.eval(js);
		} catch (e) {
			console.error(e);
			this.errors = e.stack;
		}
	};

	return html`<div id="app">
		<h1 class="center">Scramjet JS Sandbox Demo</h1>
		<div id="main">
			<div>
				<h2>Original JS</h2>
				<${Editor}
					language="javascript"
					recompile=${(value) => {
						localStorage["code"] = value;
						try {
							let rewritten = rewriteJs(value, "https://example.com", {
								url: new URL("https://example.com"),
								base: new URL("https://example.com"),
							});
							this.code.innerText = rewritten;
							run(rewritten);
						} catch (e) {
							this.code.innerText = e.stack;
						}
					}}
				/>
			</div>
			<div>
				<h2>Rewritten JS</h2>
				<div class="code" this=${use(this.code)} />
			</div>
		</div>
		<div style="display: flex; flex-direction: column; flex: 1;">
			<h1>Output</h1>
			<div id="errors">${use(this.output)}</div>
			<h1>Errors</h1>
			<div id="errors">${use(this.errors)}</div>
		</div>
	</div>`;
}
App.style = css`
	h1 {
		margin: 0;
	}
	.center {
		text-align: center;
	}
	:scope {
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100vh;
		padding: 1em;
		box-sizing: border-box;
		gap: 1em;
		overflow: hidden;
	}
	#main {
		display: flex;
		box-sizing: border-box;
		gap: 1em;
		width: 100%;
		height: 35em;
	}
	#main > * {
		width: 50%;
		/*flex: 1;*/
		display: flex;
		flex-direction: column;
	}
	.code,
	#errors {
		flex: 1;
		background: var(--bg01);
		color: var(--fg);
		font-family: monospace;
		padding: 0.5em;
		white-space: pre-wrap;
		overflow: auto;
	}
`;

app.replaceWith(html`<${App}></${App}>`);
