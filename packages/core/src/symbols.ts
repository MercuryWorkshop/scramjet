/**
 * @fileoverview
 * See `types.ts` for context on these symbols.
 */

import { Symbol_for } from "@/shared/snapshot";

export const SCRAMJETCLIENTNAME = "scramjet client global";
export const SCRAMJETCLIENT = Symbol_for(SCRAMJETCLIENTNAME);

/**
 * Marks an error whose `stack` scramjet is reading for itself. The formatter
 * `shared/error.ts` installs hands raw CallSites back for one of these instead
 * of the sanitised string a page gets, which is the only way to reach them
 * once that formatter is in place - it refuses a page's attempt to replace it,
 * and would refuse ours the same way.
 *
 * `Symbol_for` rather than a module-private symbol: the reader and the
 * formatter can end up in different bundles across realms.
 */
export const RAWFRAMES = Symbol_for("scramjet raw frames");
