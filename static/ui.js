const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.js",
		worker: "/scram/scramjet.worker.js",
		client: "/scram/scramjet.client.js",
		shared: "/scram/scramjet.shared.js",
		sync: "/scram/scramjet.sync.js",
	},
	siteFlags: {
		"https://discord.com/.*": {
			naiiveRewriter: true,
		},
	},
});

scramjet.init("./sw.js");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const flex = css`
	display: flex;
`;
const col = css`
	flex-direction: column;
`;

const store = $store(
	{
		url: "https://google.com",
		wispurl:
			_CONFIG?.wispurl ||
			(location.protocol === "https:" ? "wss" : "ws") +
				"://" +
				location.host +
				"/wisp/",
		bareurl:
			_CONFIG?.bareurl ||
			(location.protocol === "https:" ? "https" : "http") +
				"://" +
				location.host +
				"/bare/",
		proxy: "",
	},
	{ ident: "settings", backing: "localstorage", autosave: "auto" }
);
connection.setTransport("/epoxy/index.mjs", [{ wisp: store.wispurl }]);

function Config() {
	this.css = `
    .cfg * {
      margin: 2px;
    }
    .buttons button {
      border: 1px solid #4c8bf5;
      background-color: #313131;
      border-radius: 0.75em;
      color: #fff;
      padding: 0.45em;
    }
    .cfg input {
      border: none;
      background-color: #313131;
      border-radius: 0.75em;
      color: #fff;
      outline: none;
      padding: 0.45em;
    }
    .input_row input {
      flex-grow: 1;
    }
    .centered {
      justify-content: center;
      align-items: center;
    }
  `;
	return html`
      <dialog class=${["cfg"]}>
       
        <div style="align-self: end">
          <div class=${[flex, "buttons"]}>
            <button on:click=${() => connection.setTransport("/baremod/index.mjs", [store.bareurl])}>use bare server 3</button>
            <button on:click=${() =>
							connection.setTransport("/libcurl/index.mjs", [
								{
									wisp: store.wispurl,
									proxy: store.proxy ? store.proxy : undefined,
								},
							])}>use libcurl.js</button>
            <button on:click=${() => connection.setTransport("/epoxy/index.mjs", [{ wisp: store.wispurl }])}>use epoxy</button>
          </div>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="wisp_url_input">Wisp URL:</label>
          <input id="wisp_url_input" bind:value=${use(store.wispurl)}></input>
        </div>
        <div class=${[flex, col, "input_row"]}>
          <label for="bare_url_input">Bare URL:</label>
          <input id="bare_url_input" bind:value=${use(store.bareurl)}></input>
        </div>
        <div class=${[flex, "buttons", "centered"]}>
          <button on:click=${() => this.root.close()}>close</button>
        </div>
    </dialog>
  `;
}

function App() {
	this.urlencoded = "";
	this.css = `
    width: 100%;
    height: 100%;
    color: #e0def4;
    display: flex;
    flex-direction: column;
    padding: 0.5em;
    padding-top: 0;
    box-sizing: border-box;

    a {
    color: #e0def4;
    }

    input,
    button {
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont,
        sans-serif;
    }
    .version {
    }
    h1 {
      font-family: "Inter Tight", "Inter", system-ui, -apple-system, BlinkMacSystemFont,
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
    }
    spacer {
      margin-left: 10em;
    }

    .nav button {
      color: #fff;
      outline: none;
      border: none;
      border-radius: 0.30em;
      background-color: #121212;
      border: 1px solid #313131;
    }
  `;
	this.url = store.url;

	const frame = scramjet.createFrame();

	frame.addEventListener("urlchange", (e) => {
		if (!e.url) return;
		this.url = e.url;
	});
	frame.frame.addEventListener("load", () => {
		let url = frame.frame.contentWindow.location.href;
		if (!url) return;
		if (url === "about:blank") return;

		this.url = $scramjet.codec.decode(
			url.substring((location.href + "/scramjet").length)
		);
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
	document.body.appendChild(cfg);

	return html`
      <div>
      <div class=${[flex, "nav"]}>

        <button on:click=${() => cfg.showModal()}>config</button>
        <button on:click=${() => frame.back()}>&lt;-</button>
        <button on:click=${() => frame.forward()}>-&gt;</button>

        <input class="bar" bind:value=${use(this.url)} on:input=${(e) => {
					this.url = e.target.value;
				}} on:keyup=${(e) => e.keyCode == 13 && (store.url = this.url) && handleSubmit()}></input>

        <button on:click=${() => window.open(scramjet.encodeUrl(this.url))}>open</button>

        <p class="version">
          <b>scramjet</b> ${$scramjet.version.version} <a href="https://github.com/MercuryWorkshop/scramjet/tree/${$scramjet.version.build}">${$scramjet.version.build}</a>
        </p>
      </div>
      ${frame.frame}
    </div>
    `;
}

window.addEventListener("load", async () => {
	document.body.appendChild(h(App));
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
