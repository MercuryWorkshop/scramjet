/// <reference types="@rspack/core/module" />

declare global {
	interface Window {
		WASM: string;
		REAL_WASM: Uint8Array;

		/**
		 * The scramjet client belonging to a window.
		 */
		[import("./symbols").SCRAMJETCLIENT]: import("./client").ScramjetClient;
	}

	interface Document {
		/**
		 * Should be the same as window.
		 */
		[import("./symbols").SCRAMJETCLIENT]: import("./client").ScramjetClient;
	}
}

interface WebSocketCloseInfo {
	closeCode?: number;
	reason?: string;
}
interface WebSocketOpenInfo {
	extensions: string;
	protocol: string;
	readable: ReadableStream;
	writable: WritableStream;
}
interface WebSocketStreamOptions {
	protocols?: string[];
	signal?: AbortSignal;
}
interface WebSocketStream {
	readonly url: string;
	readonly opened: Promise<WebSocketOpenInfo>;
	readonly closed: Promise<WebSocketCloseInfo>;
	close(closeInfo?: WebSocketCloseInfo): void;
}
// `var`, not `let`/`const` — an interface object has to be a `var` to be
// reachable as a global value and through `keyof typeof globalThis`
// eslint-disable-next-line no-var
declare var WebSocketStream: {
	prototype: WebSocketStream;
	new (url: string, options?: WebSocketStreamOptions): WebSocketStream;
};

/**
 * The shared worker's own global scope, which only `lib.webworker.d.ts`
 * declares - and loading that alongside `lib.dom` conflicts on most of the
 * platform. `client/shared/` runs in both realms, so the one interface a
 * window-typed file has to name is declared here instead; `client/entry.ts`
 * already tests for it at run time.
 *
 * https://html.spec.whatwg.org/multipage/workers.html#sharedworkerglobalscope
 */
interface SharedWorkerGlobalScope extends EventTarget {
	readonly name: string;
	onconnect:
		| ((this: SharedWorkerGlobalScope, event: MessageEvent) => any)
		| null;
	close(): void;
}
// eslint-disable-next-line no-var
declare var SharedWorkerGlobalScope: {
	prototype: SharedWorkerGlobalScope;
	new (): SharedWorkerGlobalScope;
};

interface CSSMarginRule extends CSSRule {
	readonly name: string;
	readonly style: CSSStyleDeclaration;
}
// eslint-disable-next-line no-var
declare var CSSMarginRule: {
	prototype: CSSMarginRule;
	new (): CSSMarginRule;
};

interface CSSPositionTryRule extends CSSRule {
	readonly name: string;
	readonly style: CSSStyleDeclaration;
}
// eslint-disable-next-line no-var
declare var CSSPositionTryRule: {
	prototype: CSSPositionTryRule;
	new (): CSSPositionTryRule;
};

declare const dbg: {
	log: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
	error: (message: string, ...args: any[]) => void;
	debug: (message: string, ...args: any[]) => void;
	time: (meta: URLMeta, before: number, type: string) => void;
};

declare type GlobalThis = typeof globalThis;
declare type Self = Window & GlobalThis;

/**
 * lib.dom declares `CookieListItem` as `{ name?, value? }`, which is what the
 * Cookie Store spec's *idl-less* prose once said. The spec's dictionary — and
 * what Chrome actually resolves `cookieStore.get()` with — carries the full
 * attribute set, so declare the rest here.
 *
 * Merges with the lib.dom interface rather than replacing it; this file is a
 * script, so a top-level interface is already global.
 *
 * https://cookiestore.spec.whatwg.org/#dictdef-cookielistitem
 */
interface CookieListItem {
	/** null for a host-only cookie */
	domain?: string | null;
	path?: string;
	/** ms since the epoch, null for a session cookie */
	expires?: DOMHighResTimeStamp | null;
	secure?: boolean;
	sameSite?: CookieSameSite;
	partitioned?: boolean;
}
