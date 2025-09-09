/**
 * @fileoverview
 * Global type declarations for Scramjet proxy library.
 *
 * @packageDocumentation
 */

import {
	$scramjetLoadController as _$scramjetLoadController,
	$scramjetLoadClient as _$scramjetLoadClient,
	$scramjetLoadWorker as _$scramjetLoadWorker,
} from "../entry.js";

export type { ScramjetController } from "../controller/index.js";
export type { ScramjetClient } from "../client/index.js";
export type { ScramjetServiceWorker } from "../worker/index.js";
export type { ScramjetInitConfig, ScramjetFlags } from "../types.js";
export type { ScramjetFrame } from "../controller/frame.js";

/**
 * {@inheritDoc _$scramjetLoadController}
 * @public
 */
declare global {
	const $scramjetLoadController: typeof _$scramjetLoadController;
}

/**
 * {@inheritDoc _$scramjetLoadClient}
 * @public
 */
declare global {
	const $scramjetLoadClient: typeof _$scramjetLoadClient;
}

/**
 * {@inheritDoc _$scramjetLoadWorker}
 * @public
 */
declare global {
	const $scramjetLoadWorker: typeof _$scramjetLoadWorker;
}
