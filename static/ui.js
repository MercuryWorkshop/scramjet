navigator.serviceWorker.register("./sw.js", {
    scope: __scramjet$config.prefix
})
BareMux.SetTransport("BareMod.BareClient", (location.protocol === "https:" ? "https" : "http") + "://" + location.host + "/bare/")
const flex = css`display: flex;`;
const col = css`flex-direction: column;`;
const store = $store({
    url: "https://google.com",
    wispurl: "wss://wisp.mercurywork.shop/",
    bareurl: (location.protocol === "https:" ? "https" : "http") + "://" + location.host + "/bare/",
}, { ident: "settings", backing: "localstorage", autosave: "auto" });
BareMux.SetTransport("BareMod.BareClient", (location.protocol === "https:" ? "https" : "http") + "://" + location.host + "/bare/")
function App() {
    this.urlencoded = "";
    this.css = `
        width: 100%;
        height:100%;
        color:  #e0def4;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction:column;
      h1 {
        font-family: "Inter";
        text-align: center;
      }
      iframe {
        border: 8px solid #11528f;
        background-color: #11528f;
        border-radius: 25px;
        margin: 2em;
        width: calc(100% - 4em);
        height: calc(100% - 8em);
      }
  
      input.bar {
        border: none;
        outline: none;
        color: #191724;
        height:2em;
        width:60%;
        text-align:center;
        border-radius: 5px;
        background-color: #eb6f92;
      }
      .cfg * {
        margin: 2px;
      }
      .buttons button {
        border: 4px solid #11528f;
        background-color: #eb6f92;
        color: #191724;
      }
      .cfg input {
        border: 3px solid #3d84a8;
        background-color: #eb6f92;
        outline: none;
      }
  `;
  
    return html`
      <div>
      <h1>Percury Unblocker</h1>
      surf the unblocked and mostly buggy web

      <div class=${[flex, col, "cfg"]}>
        <input bind:value=${use(store.wispurl)}></input>
        <input bind:value=${use(store.bareurl)}></input>


        <div class=${[flex, "buttons"]}>
          <button on:click=${() => BareMux.SetTransport("BareMod.BareClient", store.bareurl)}>use bare server 3</button>
          <button on:click=${() => BareMux.SetTransport("CurlMod.LibcurlClient", { wisp: store.wispurl })}>use libcurl.js</button>
          <button on:click=${() => BareMux.SetTransport("EpxMod.EpoxyClient", { wisp: store.wispurl })}>use epoxy</button>
          <button on:click=${() => BareMux.SetSingletonTransport(new BareMod.BareClient(store.bareurl))}>use bare server 3 (remote)</button>
        </div>
      </div>
      <input class="bar" bind:value=${use(store.url)} on:input=${(e) => (store.url = e.target.value)} on:keyup=${(e) => e.keyCode == 13 && console.log(this.urlencoded = __scramjet$config.prefix + __scramjet$config.codec.encode(e.target.value))} />
      <iframe src=${use(this.urlencoded)}></iframe>
    </div>
    `
}

window.addEventListener("load", () => {
    document.body.appendChild(h(App))
})