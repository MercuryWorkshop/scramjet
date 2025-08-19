# Development Setup

Node.js 22+ and depot_tools are required for development

```bash
update_depot_tools
ensure_bootstrap
git clone https://github.com/HeyPuter/browser.js --recursive
cd browser.js
pnpm i
rustup update
rustup install nightly
rustup default nightly
cargo install --git https://github.com/r58playz/wasm-snip
cargo install wasm-bindgen-cli --version 0.2.100
pnpm rewriter:build
pnpm build
cd dreamlandjs
pnpm build
cd ..
cd chii
pnpm init:front_end
pnpm build
cd ..
cd playwright
npm i
npm run build
cd web_builder
npx rollup -c
cd ../..
cd chobitsu
pnpm build
cd ..
cd chobitsu_inject
npx rollup -c
cd ..
cd frontend
pnpm vite build
```

# Incremental Build

```bash
(cd playwright && npm run watch) &
(cd playwright/web_builder && npx rollup -cw) &
(pnpm dev) &
(cd dreamlandjs && pnpm watch) &
(cd chobitsu && pnpm webpack --watch --mode=development) &
(cd chobitsu_inject && npx rollup -cw) &
(cd frontend && pnpm dev) &
```
