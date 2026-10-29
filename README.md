# TCMs Proxy

TCMs Proxy is a browser-style interface built on [Scramjet](https://github.com/MercuryWorkshop/scramjet). It gives the proxy a custom start page with a search bar, personal shortcuts, and a small games directory while keeping Scramjet's browser, request-inspection, and playground tools available.

## Start page

- Switch searches between Google, Bing, DuckDuckGo, and Brave.
- Add, edit, and remove your own shortcuts. They are saved in this browser on this device.
- Browse quick previews for Eaglercraft, Slope, 1v1.LOL, Run 3, and Cookie Clicker.

Third-party sites are not operated by TCMs Proxy, and availability can vary by network. Follow the rules that apply to the network you are using.

## About Scramjet

Scramjet is an experimental interception-based web proxy designed to sandbox web content and rewrite browser requests. TCMs Proxy uses Scramjet as its underlying engine; see the [Scramjet repository](https://github.com/MercuryWorkshop/scramjet) for technical details and upstream development. This project retains the upstream AGPL-3.0-only license.

## Development

### Requirements

- Recent versions of Node.js and `pnpm`
- `rustup`, `wasm-bindgen`, Binaryen's `wasm-opt`, and the project's `wasm-snip` fork to rebuild the WebAssembly rewriter

### Install and run

```sh
pnpm install
cd packages/core
pnpm rewriter:build
cd ../..
pnpm dev
```

The local interface runs at <http://localhost:4141>. The development server also starts the Wisp WebSocket service used by the proxy. The rewriter build uses the toolchain in `packages/core/rewriter/wasm/build.sh`; the main Rspack build is configured in `rspack.config.ts`.
