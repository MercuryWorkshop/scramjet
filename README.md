<div align="center">
  <img src="assets/scramjet.png" height="200" />
</div>

---
<a href="https://www.npmjs.com/package/@mercuryworkshop/scramjet"><img src="https://img.shields.io/npm/v/@mercuryworkshop/scramjet.svg?maxAge=3600" alt="npm version" /></a>

Scramjet is an experimental web proxy that aims to be the successor to Ultraviolet.

It currently does not support most websites due to it being very early in the development stage.

The UI is not finalized and only used as a means to test the web proxy.

## How to build

Running `pnpm dev` will build Scramjet and start a dev server on localhost:1337. If you only want to build the proxy without using the dev server, run `pnpm build`.

## TODO

- Finish HTML rewriting
  - `<script type="importmap"></script>` rewriting
    - Make an array of all possible import values and pass the array onto the JS rewriter, then rewrite all the URLs inside of it
- Finish JS rewriting
  - Check imports/exports for values contained in the `importmap` array, don't rewrite the node value if present
- Write client APIs
