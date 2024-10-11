const scramjet = new ScramjetController({
	wasm: "/scram/scramjet.wasm.js",
	codecs: "/scram/scramjet.codecs.js",
	worker: "/scram/scramjet.worker.js",
	thread: "/scram/scramjet.thread.js",
	client: "/scram/scramjet.client.js",
	shared: "/scram/scramjet.shared.js",
	sync: "/scram/scramjet.sync.js",
});

scramjet.init("./sw.js");

// navigator.serviceWorker.ready.then((reg) => {
// 	for (let i = 0; i < 20; i++) {
// 		const thread = new SharedWorker($scramjet.config.thread, {
// 			name: "thread" + i,
// 		});
//
// 		reg.active.postMessage(
// 			{
// 				scramjet$type: "add",
// 				handle: thread.port,
// 			},
// 			[thread.port]
// 		);
// 	}
// });

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
			(location.protocol === "https:" ? "wss" : "ws") +
			"://" +
			location.host +
			"/wisp/",
		bareurl:
			(location.protocol === "https:" ? "https" : "http") +
			"://" +
			location.host +
			"/bare/",
		proxy: "",
	},
	{ ident: "settings", backing: "localstorage", autosave: "auto" },
);
connection.setTransport("/libcurl/index.mjs", [{ wisp: store.wispurl }]);
function App() {
	this.urlencoded = "";
	this.css = `
    width: 100%;
    height: 100%;
    color: #e0def4;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    input,
    button {
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont,
        sans-serif;
    }
    h1 {
      font-family: "Inter Tight", "Inter", system-ui, -apple-system, BlinkMacSystemFont,
      sans-serif;
      margin-bottom: 0;
    }
    iframe {
      border: 2px solid #313131;
      background-color: #fff;
      border-radius: 0.5rem;
      margin: 1em;
      margin-top: 0.5em;
      width: calc(100% - 2em);
      height: calc(100% - 8em);
    }

    input.bar {
      border: none;
      outline: none;
      color: #fff;
      height: 2em;
      text-align: center;
      border-radius: 0.75em;
      background-color: #313131;
      padding: 0.30em;
    }
    .input_row > label {
      font-size: 0.7rem;
      color: gray;
    }
    p {
      margin: 0;
      margin-top: 0.2em;
    }
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
      flex-grow: 1
    }

    .nav button {
      margin-right: 0.25em;
      margin-left: 0.25em;
      color: #fff;
      outline: none;
      border: none;
      border-radius: 0.75em;
      background-color: #313131;
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

		this.url = $scramjet.codecs.plain.decode(
			url.substring((location.href + "/scramjet").length),
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

	return html`
      <div>
      <h1>Percury Unblocker</h1>
      <p>surf the unblocked and mostly buggy web</p>

      <div class=${[flex, "cfg"]}>
       
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
            <button on:click=${() => window.open(this.urlencoded)}>open in fullscreen</button>
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
    </div>
      <div class=${[flex, "nav"]} style="width: 60%">
        <button on:click=${() => frame.back()}>&lt;-</button>
        <input class="bar" style="flex: 1" bind:value=${use(this.url)} on:input=${(
					e,
				) => {
					this.url = e.target.value;
				}} on:keyup=${(e) => e.keyCode == 13 && (store.url = this.url) && handleSubmit()}></input>
        <button on:click=${() => frame.forward()}>-&gt;</button>
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
`,
	);
});
