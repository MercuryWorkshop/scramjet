import { css, h } from "dreamland/core";
import { html } from "dreamland/js-runtime";
import { store } from "./store.js";
const { ScramjetController } = $scramjetLoadController();
console.log(store);

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	wisp: "ws://localhost:1337/",
	flags: {
		rewriterLogs: false,
		scramitize: false,
		cleanErrors: true,
		sourcemaps: true,
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

window.html = html;
window.h = h;
window.c = Config;
function Config(cx) {
	function handleModalClose(modal) {
		modal.style.opacity = 0;
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
		}, 250);
	}

	return html`
       <dialog class="cfg" style="background-color: #121212; color: white; border-radius: 8px;">
         <div style="align-self: end">
           <div class="buttons" style="display: flex">
             <button on:click=${() => {
								connection.setTransport("/baremod/index.mjs", [store.bareurl]);
								store.transport = "/baremod/index.mjs";
							}}>use bare server 3</button>
             <button on:click=${() => {
								connection.setTransport("/libcurl/index.mjs", [
									{ wisp: store.wispurl },
								]);
								store.transport = "/libcurl/index.mjs";
							}}>use libcurl.js</button>
               <button on:click=${() => {
									connection.setTransport("/epoxy/index.mjs", [
										{ wisp: store.wispurl },
									]);
									store.transport = "/epoxy/index.mjs";
								}}>use epoxy</button>
           </div>
         </div>
         <div class="input_row" style="display: flex; flex-direction: column">
           <label for="wisp_url_input">Wisp URL:</label>
           <input id="wisp_url_input" value=${use(store.wispurl)} spellcheck="false"></input>
         </div>
         <div class="input_row" style="display: flex; flex-direction: column">
           <label for="bare_url_input">Bare URL:</label>
           <input id="bare_url_input" value=${use(store.bareurl)} spellcheck="false"></input>
         </div>
         <div>${use(store.transport)}</div>
         <div class="buttons centered" style="display: flex">
           <button on:click=${() => handleModalClose(cx.root)}>close</button>
         </div>
       </dialog>
   `;
}
Config.style = css`
	:scope {
		transition: opacity 0.4s ease;
	}
	:modal[open] {
		animation: fade 0.4s ease normal;
	}

	:modal::backdrop {
		backdrop-filter: blur(3px);
	}

	.buttons {
		gap: 0.5em;
		display: flex;
	}
	.buttons button {
		border: 1px solid #4c8bf5;
		background-color: #313131;
		border-radius: 0.75em;
		color: #fff;
		padding: 0.45em;
	}
	.input_row input {
		background-color: rgb(18, 18, 18);
		border: 2px solid rgb(49, 49, 49);
		border-radius: 0.75em;
		color: #fff;
		outline: none;
		padding: 0.45em;
	}
	.input_row {
		margin-bottom: 0.5em;
		margin-top: 0.5em;
	}
	.input_row input {
		flex-grow: 1;
	}
	.centered {
		justify-content: center;
		align-items: center;
	}

	.flex-column {
		display: flex;
		flex-direction: column;
	}
`;

function BrowserApp(cx) {
	this.url = store.url;

	const frame = scramjet.createFrame();

	cx.mount = () => {
		let body = btoa(
			`<body style="background: #000; color: #fff">Welcome to <i>Scramjet</i>! Type in a URL in the omnibox above and press enter to get started.</body>`
		);
		frame.go(`data:text/html;base64,${body}`);
	};

	frame.addEventListener("urlchange", (e) => {
		if (!e.url) return;
		this.url = e.url;
	});

	const handleSubmit = () => {
		this.url = this.url.trim();
		//  frame.go(this.url)
		if (!this.url.startsWith("http")) {
			this.url = "https://" + this.url;
		}

		return frame.go(this.url);
	};

	const cfg = h(Config);
	console.log(cfg);
	this.githubURL = `https://github.com/MercuryWorkshop/scramjet/commit/${$scramjetVersion.build}`;
	document.body.appendChild(cfg);
	this.githubURL = `https://github.com/MercuryWorkshop/scramjet/commit/${$scramjetVersion.build}`;

	return html`
      <div>
      <div class="nav" style="display: flex">

        <button on:click=${() => cfg.showModal()}>config</button>
        <button on:click=${() => frame.back()}>&lt;-</button>
        <button on:click=${() => frame.forward()}>-&gt;</button>
        <button on:click=${() => frame.reload()}>&#x21bb;</button>

        <input class="bar" autocomplete="off" autocapitalize="off" autocorrect="off"
        value=${use(this.url)} on:input=${(e) => {
					this.url = e.target.value;
				}} on:keyup=${(e) => e.keyCode == 13 && (store.url = this.url) && handleSubmit()}></input>

        <button on:click=${() => window.open(scramjet.encodeUrl(this.url))}>open</button>

        <p class="version">
          <b>scramjet</b> ${$scramjetVersion.version} <a href=${use(this.githubURL)}>${$scramjetVersion.build}</a>
        </p>
      </div>
      ${frame.frame}
    </div>
   `;
}

BrowserApp.style = css`
	:scope {
		width: 100%;
		height: 100%;
		color: #e0def4;
		display: flex;
		flex-direction: column;
		padding: 0.5em;
		padding-top: 0;
		box-sizing: border-box;
	}

	a {
		color: #e0def4;
	}

	input,
	button {
		font-family:
			"Inter",
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
	}
	.version {
	}
	h1 {
		font-family:
			"Inter Tight",
			"Inter",
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		margin-bottom: 0;
	}
	iframe {
		background-color: #fff;
		border: none;
		border-radius: 0.3em;
		flex: 1;
		width: 100%;
	}

	input.bar {
		font-family: "Inter";
		padding: 0.1em;
		padding-left: 0.3em;
		border: none;
		outline: none;
		color: #fff;
		height: 1.5em;
		border-radius: 0.3em;
		flex: 1;

		background-color: #121212;
		border: 1px solid #313131;
	}
	.input_row > label {
		font-size: 0.7rem;
		color: gray;
	}
	p {
		margin: 0;
		margin-top: 0.2em;
	}

	.nav {
		padding-top: 0.3em;
		padding-bottom: 0.3em;
		gap: 0.3em;
		display: flex;
	}
	spacer {
		margin-left: 10em;
	}

	.nav button {
		color: #fff;
		outline: none;
		border: none;
		border-radius: 0.3em;
		background-color: #121212;
		border: 1px solid #313131;
	}
`;
window.addEventListener("load", async () => {
	const root = document.getElementById("app");
	try {
		root.replaceWith(h(BrowserApp));
	} catch (e) {
		root.replaceWith(document.createTextNode("" + e));
		throw e;
	}
	function b64(buffer) {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}

		return btoa(binary);
	}
	const arraybuffer = await (await fetch("/assets/scramjet.png")).arrayBuffer();
	console.log(
		"%cb",
		`
      background-image: url(data:image/png;base64,${b64(arraybuffer)});
      color: transparent;
      padding-left: 200px;
      padding-bottom: 100px;
      background-size: contain;
      background-position: center center;
      background-repeat: no-repeat;
  `
	);
});
