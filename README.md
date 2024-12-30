<div align="center">
  <img src="assets/scramjet.png" height="200" />
</div>

---

> [!WARNING]  
> Scramjet is not currently production ready, DO NOT USE THIS AS THE MAIN OPTION IN YOUR SITE.

<a href="https://www.npmjs.com/package/@mercuryworkshop/scramjet"><img src="https://img.shields.io/npm/v/@mercuryworkshop/scramjet.svg?maxAge=3600" alt="npm version" /></a>

Scramjet is an experimental interception based web proxy that aims to be the successor to Ultraviolet. It is designed with security, developer friendliness, and performance in mind. Scramjet strives to have a clean, organized codebase to improve maintainability. Scramjet is made to evade internet censorship and bypass arbitrary web browser restrictions.

## Supported Sites

Some of the popular websites that Scramjet supports include:

-   [Google](https://google.com)
-   [Youtube](https://www.youtube.com)
-   [Spotify](https://spotify.com)
-   [Discord](https://discord.com)
-   [Reddit](https://reddit.com)
-   [GeForce NOW](https://play.geforcenow.com/)
-   [now.gg](https://now.gg)

## Development

### Dependencies

-   Recent versions of `node.js` and `pnpm`
-   `rustup`
-   `wasm-bindgen`
-   [Binaryen's `wasm-opt`](https://github.com/WebAssembly/binaryen)
-   [this `wasm-snip` fork](https://github.com/r58Playz/wasm-snip)

#### Building

-   Clone the repository with `git clone --recursive https://github.com/MercuryWorkshop/scramjet`
-   Install the dependencies with `pnpm i`
-   Build the rewriter with `pnpm rewriter:build`
-   Build Scramjet with `pnpm build`

### Running Scramjet Locally

You can run the Scramjet dev server with the command

```sh
pnpm dev
```

Scramjet should now be running at `localhost:1337` and should rebuild upon a file being changed (excluding the rewriter).
