// NOTE: this is the entrypoint for scramjet.bundle.js
// as such it exports everything in scramjet
// the entry point for scramjet.all.js (what most sites wil use) is entry.ts

import { setWasm } from "@rewriters/wasm";
import "./global.d";
export * from "./client";
export * from "./shared";
export * from "./symbols";
export * from "./types";
export * from "./fetch";

declare const REWRITERWASM: string | undefined;

// bundled build will have the wasm binary inlined as a base64 string
if (REWRITERWASM) {
	setWasm(Uint8Array.from(atob(REWRITERWASM), (c) => c.charCodeAt(0)));
}
