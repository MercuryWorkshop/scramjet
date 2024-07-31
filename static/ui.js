const bootstrapper = new ScramjetBootstrapper({
  codecs: "/scram/scramjet.codecs.js",
  worker: "/scram/scramjet.worker.js",
  thread: "/scram/scramjet.thread.js",
  client: "/scram/scramjet.client.js",
  shared: "/scram/scramjet.shared.js",
});

bootstrapper.registerSw("./sw.js");

navigator.serviceWorker.ready.then((reg) => {
	for (let i = 0; i < 20; i++) {
		const thread = new SharedWorker($scramjet.config.thread, {
			name: "thread" + i,
		});

		reg.active.postMessage(
			{
				scramjet$type: "add",
				handle: thread.port,
			},
			[thread.port]
		);
	}
});

navigator.serviceWorker.onmessage = ({ data }) => {
	if (data.scramjet$type === "getLocalStorage") {
		const pairs = Object.entries(localStorage);
		navigator.serviceWorker.controller.postMessage({
			scramjet$type: "getLocalStorage",
			scramjet$token: data.scramjet$token,
			data: pairs,
		});
	} else if (data.scramjet$type === "setLocalStorage") {
		for (const [key, value] of data.data) {
			localStorage.setItem(key, value);
		}
		navigator.serviceWorker.controller.postMessage({
			scramjet$type: "setLocalStorage",
			scramjet$token: data.scramjet$token,
		});
	}
};

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
	{ ident: "settings", backing: "localstorage", autosave: "auto" }
);
connection.setTransport("/baremod/index.mjs", [store.bareurl]);
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
      border: 4px solid #313131;
      background-color: #121212;
      border-radius: 1rem;
      margin: 2em;
      margin-top: 0.5em;
      width: calc(100% - 4em);
      height: calc(100% - 8em);
    }

    input.bar {
      border: none;
      outline: none;
      color: #fff;
      height: 2em;
      width: 60%;
      text-align: center;
      border-radius: 0.75em;
      background-color: #313131;
      padding: 0.45em;
    }
    .cfg * {
      margin: 2px;
    }
    .buttons button {
      border: 2px solid #4c8bf5;
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
  `;

	return html`
      <div>
      <h1>Percury Unblocker</h1>
      <p>surf the unblocked and mostly buggy web</p>

      <div class=${[flex, col, "cfg"]}>
        <div class=${[flex, "input_row"]}>
          <label for="wisp_url_input">Wisp URL:</label>
          <input id="wisp_url_input" bind:value=${use(store.wispurl)}></input>
        </div>
        <div class=${[flex, "input_row"]}>
          <label for="bare_url_input">Bare URL:</label>
          <input id="bare_url_input" bind:value=${use(store.bareurl)}></input>
        </div>
        <div class=${[flex, "input_row"]}>
          <label for="proxy_url_input">SOCKS/HTTP Proxy URL:</label>
          <input id="proxy_url_input" bind:value=${use(store.proxy)}></input>
        </div>

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
      <input class="bar" bind:value=${use(store.url)} on:input=${(e) => (store.url = e.target.value)} on:keyup=${(e) => e.keyCode == 13 && console.log((this.urlencoded = $scramjet.config.prefix + $scramjet.codec.encode(e.target.value)))}></input>
      <iframe src=${use(this.urlencoded)}></iframe>
    </div>
    `;
}

window.addEventListener("load", async () => {
	document.body.appendChild(h(App));
	function b64(buffer) {
		let binary = "";
		let bytes = new Uint8Array(buffer);
		let len = bytes.byteLength;
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
