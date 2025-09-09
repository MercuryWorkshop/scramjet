/// <reference types="@rspack/core/module" />

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
 * @category Window Context
 */
export type { ScramjetFlags } from "./types";

/**
 * @category Window Context
 */
export type { ScramjetInitConfig } from "./types";

/**
 * @category Window Context
 */
export type { ScramjetGlobalEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetGlobalDownloadEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetGlobalEvents } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetDownload } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetEvents } from "./client/events";

/**
 * @category Window Context
 */
export type { NavigateEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { UrlChangeEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetContextEvent } from "./client/events";

/**
 * @category Window Context
 */
export type { ScramjetController } from "./controller";

/**
 * @category Window Context
 */
export type { ScramjetFrame } from "./controller/frame";

/**
 * @category Window Context
 */
export type { ScramjetClient } from "./client";

/**
 * @category Service Worker Context
 */
export type { ScramjetServiceWorker } from "./worker";

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
export function $scramjetLoadController(): {
	ScramjetController: typeof import("./controller").ScramjetController;
} {
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
export function $scramjetLoadClient(): {
	ScramjetClient: typeof import("./client").ScramjetClient;
	[key: string]: any;
} {
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
export function $scramjetLoadWorker(): {
	ScramjetServiceWorker: typeof import("./worker").ScramjetServiceWorker;
} {
	return require("./worker/index");
}

globalThis.$scramjetRequire = function (path: string) {
	return require(path);
};

/**
 * Version information for the current Scramjet build.
 * Contains both the semantic version string and the git commit hash for build identification.
 *
 * @category Window Context
 */
export interface ScramjetVersionInfo {
	/** The git commit hash that this build was created from */
	build: string;
	/** The semantic version */
	version: string;
}

/**
 * Version information for the current Scramjet build.
 *
 * @category Window Context
 */
export const $scramjetVersion: ScramjetVersionInfo = {
	build: COMMITHASH,
	version: VERSION,
};

(globalThis as any).$scramjetLoadController = $scramjetLoadController;
(globalThis as any).$scramjetLoadClient = $scramjetLoadClient;
(globalThis as any).$scramjetLoadWorker = $scramjetLoadWorker;
(globalThis as any).$scramjetVersion = $scramjetVersion;

if ("document" in globalThis && document?.currentScript) {
	document.currentScript.remove();
}
