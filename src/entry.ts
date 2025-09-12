/// <reference types="@rspack/core/module" />

import type { ScramjetVersionInfo } from "./types";

/**
 * Hash of the current commit in `MercuryWorkshop/scramjet` Scramjet was built from.
 */
declare const COMMITHASH: string;
/**
 * Semantic version of the current Scramjet build.
 */
declare const VERSION: string;

/**
 * @fileoverview Scramjet Entry Point. This module contain global constants and factory functions to load the APIs in the bundle.
 *
 * @categoryDescription Window Context
 * APIs for the main window context, which includes creating Scramjet Frames and the Controller for managing the Scramjet proxy behavior in the SW.
 * @categoryDescription Service Worker Context
 * APIs designed for the service worker context, where the core logic resides. These are the essentials and include the the `ScramjetServiceWorker`.
 */

/**
 * Factory function that creates the `ScramjetController` class.
 *
 * @returns The `ScramjetController` class.
 *
 * @example
 * ```typescript
 * const { ScramjetController } = $scramjetLoadController();
 *
 * const scramjet = new ScramjetController({
 *   prefix: "/scramjet/"
 * });
 *
 * await scramjet.init();
 *
 * const frame = scramjet.createFrame();
 * document.body.appendChild(frame.frame);
 * frame.navigate("https://example.com");
 * ```
 *
 * @category Window Context
 */
export function $scramjetLoadController() {
	return require("./controller/index");
}
/**
 * Factory function that creates the `ScramjetClient` for controlling sandboxing.
 *
 * @returns The `ScramjetClient` class.
 *
 * @example
 * ```typescript
 * const ScramjetClient = $scramjetLoadClient();
 *
 * const scramjetClient = new ScramjetClient.ScramjetClient();
 * ```
 * @category Window Context
 */
export function $scramjetLoadClient() {
	return require("./client/entry");
}
/**
 * Factory function that creates the `ScramjetServiceWorker` class.
 *
 * @returns The `ScramjetServiceWorker` class.
 *
 * Plain SW example
 * @example
 * ```typescript
 * // In your Service Worker
 * const { ScramjetServiceWorker } = $scramjetLoadWorker();
 *
 * const scramjet = new ScramjetServiceWorker();
 *
 * self.addEventListener("fetch", async (ev) => {
 *   await scramjet.loadConfig();
 *
 *   if (scramjet.route(ev)) {
 *     ev.respondWith(scramjet.fetch(ev));
 *   }
 * });
 * ```
 *
 * Workbox-powered SW routing example
 * @example
 * ```typescript
 * // In your Service Worker (ensure you are using a bundler for Workbox)
 * // This is more useful for a webOS or if you have Offline PWA support on your proxy site
 * import { registerRoute } from 'workbox-routing';
 *
 * const { ScramjetServiceWorker } = $scramjetLoadWorker();
 *
 * const scramjet = new ScramjetServiceWorker();
 *
 * registerRoute(
 *   ({ request }) => {
 *     return scramjet.route({ request });
 *   },
 *   async ({ event }) => {
 *     await scramjet.loadConfig();
 *
 *     return scramjet.fetch(event);
 *   }
 * );
 * ```
 *
 * @category Service Worker Context
 */
export function $scramjetLoadWorker() {
	return require("./worker/index");
}

globalThis.$scramjetRequire = function (path: string) {
	return require(path);
};

/**
 * Version information for the current Scramjet build.
 *
 * @category Window Context
 */
export const $scramjetVersion: ScramjetVersionInfo = {
	build: COMMITHASH,
	version: VERSION,
};

globalThis.$scramjetLoadController = $scramjetLoadController;
globalThis.$scramjetLoadClient = $scramjetLoadClient;
globalThis.$scramjetLoadWorker = $scramjetLoadWorker;
globalThis.$scramjetVersion = $scramjetVersion;

if ("document" in globalThis && document?.currentScript) {
	document.currentScript.remove();
}
