import { IncrementalHtmlRewriter } from "@/shared";
import { ScramjetClient } from "./client";
import { SourceMaps } from "./shared/sourcemaps";
import {
	Object_getOwnPropertyNames,
	Object_getOwnPropertyDescriptor,
	_WeakMap,
	_Map,
	_WeakSet,
	Object_create,
	Function_hasInstance,
} from "@/shared/snapshot";
import { FakeWebSocketState } from "./shared/requests/WebSocket";
import { FakeWebSocketStreamState } from "./shared/requests/WebSocketStream";

export class SingletonBox {
	clients: ScramjetClient[] = [];
	globals: _Map<Self, ScramjetClient> = new _Map([]);
	documents: _Map<Document, ScramjetClient> = new _Map([]);
	histories: _Map<History, ScramjetClient> = new _Map([]);
	/**
	 * Keyed on each realm's `Object.prototype`, which every object created in
	 * that realm reaches at the end of its prototype chain. One entry per realm
	 * rather than one per interface.
	 */
	realms: _Map<object, ScramjetClient> = new _Map([]);
	locations: _Map<Location, ScramjetClient> = new _Map([]);
	functions: _Map<typeof Function, ScramjetClient> = new _Map([]);
	writeRewriters: _WeakMap<Document, IncrementalHtmlRewriter> = new _WeakMap(
		[]
	);
	taggedHeaders: _WeakSet<Headers> = new _WeakSet([]);
	taggedResponses: _WeakSet<Response> = new _WeakSet([]);
	scopedOpfsRoots: _WeakSet<FileSystemHandle> = new _WeakSet();
	styleDeclarations: _WeakMap<CSSStyleDeclaration, CSSStyleDeclaration> =
		new _WeakMap();
	eventcallbacks: _WeakMap<
		EventTarget,
		_Map<string, _WeakMap<object, (...args: any) => any>>
	> = new _WeakMap();

	/**
	 * The wrapper handed back in place of each element's `NamedNodeMap`, and the
	 * element each map belongs to.
	 *
	 * `attributes` is `[SameObject]`, so `el.attributes === el.attributes` has to
	 * hold and a fresh Proxy per read is a one-expression tell. The wrapper is
	 * what hides scramjet's own attributes and surfaces the ones a rewrite rule
	 * removed, which the native map knows nothing about.
	 *
	 * The owner is recorded because a `NamedNodeMap` has no back-reference to its
	 * element, and `setNamedItem` has to reach the element to rewrite what it is
	 * inserting - including on a map that is currently empty, where there is no
	 * attribute to ask.
	 *
	 * Shared rather than per-client for the same reason `styleDeclarations` is:
	 * [SameObject] is a property of the element, not of the realm reading it.
	 */
	attributeMaps: _WeakMap<NamedNodeMap, NamedNodeMap> = new _WeakMap();
	attributeOwners: _WeakMap<NamedNodeMap, Element> = new _WeakMap();
	/** The reverse of `attributeMaps`: the real map behind each wrapper. */
	attributeMapTargets: _WeakMap<NamedNodeMap, NamedNodeMap> = new _WeakMap();

	/**
	 * Each element's [[CryptographicNonce]] - what the `nonce` IDL attribute
	 * answers with. Kept apart from the content attribute because the spec
	 * does: writing `el.nonce` changes only the slot, and a page reading
	 * `getAttribute("nonce")` afterwards sees the attribute it last wrote.
	 * An element with no entry has never had either written by script, and
	 * falls back to its (mirrored) content attribute.
	 */
	nonces: _WeakMap<Element, string> = new _WeakMap();

	/**
	 * A detached iframe per live one, carrying the page's `sandbox` value.
	 *
	 * The rewrite rule strips the real attribute - a sandboxed frame cannot
	 * run the proxy - so `iframe.sandbox`, a token list over that attribute,
	 * would read an empty list and write the live frame's sandbox. The
	 * stand-in's own list is handed out instead: a real `DOMTokenList`, with
	 * the engine's own `supports()`, indexing and serialization.
	 */
	sandboxStandIns: _WeakMap<Element, Element> = new _WeakMap();
	/** The iframe each stand-in's token list belongs to. */
	sandboxLists: _WeakMap<DOMTokenList, Element> = new _WeakMap();

	/**
	 * The element each inline style declaration (and typed OM map) belongs to,
	 * so that a write through CSSOM can bring the element's `style` mirror up
	 * to date. Without it `el.style.color = "blue"` changes the attribute the
	 * document holds and leaves `getAttribute("style")` answering with the
	 * value before it.
	 */
	inlineStyleOwners: _WeakMap<object, Element> = new _WeakMap();

	/**
	 * The original text of every script and style element whose source scramjet
	 * rewrote, and of every character data node inside one.
	 *
	 * A script's source also lives in an attribute (the HTML rewriter writes it
	 * there, and it survives cloning and serialization), but a style's has
	 * nowhere to go, and a text node's has to be tracked per node so that the
	 * concatenation of an element's children can be rebuilt from its parts.
	 *
	 * Shared rather than per-client because a node reached from a second frame
	 * has to report the same text it does in the first.
	 */
	elementSources: _WeakMap<Element, string> = new _WeakMap();
	characterDataSources: _WeakMap<CharacterData, string> = new _WeakMap();

	/**
	 * The element each `SVGAnimatedString` handed out for an `href` belongs to.
	 *
	 * `SVGAnimatedString` carries no back-reference to its element or to the
	 * attribute it reflects, and `svg.href.baseVal` has to answer with the URL
	 * the page wrote rather than the rewritten one in the document. Recorded when
	 * the element's `href` is read, which is the only way to reach the object;
	 * `href` is [SameObject], so one entry answers for every later read.
	 *
	 * Keyed this way round rather than un-rewriting whatever string turns up: an
	 * `SVGAnimatedString` is also `className` and `target`, and running a class
	 * list through the URL un-rewriter is both wrong and loud.
	 */
	svgHrefs: _WeakMap<SVGAnimatedString, Element> = new _WeakMap();

	// real events that we're wrapping in event.ts
	wrappedEvents: _WeakMap<Event, Event> = new _WeakMap();
	// the reverse: the real event behind each stand-in event.ts hands out
	standIns: _WeakMap<Event, Event> = new _WeakMap();
	// fake events that scramjet synthesized
	trustedEvents: _WeakSet<Event> = new _WeakSet();
	// the page's function behind each wrapper event.ts puts in an `on*` slot
	eventhandlers: _WeakMap<object, (...args: any) => any> = new _WeakMap();

	unproxy: _Map<any, any> = new _Map([]);

	socketmap: _WeakMap<WebSocket, FakeWebSocketState> = new _WeakMap([]);
	socketstreammap: _WeakMap<WebSocketStream, FakeWebSocketStreamState> =
		new _WeakMap([]);

	ctors: Record<string, Function[]> = Object_create(null);

	sourcemaps: SourceMaps = {};

	constructor(public ownerclient: ScramjetClient) {}

	registerClient(client: ScramjetClient, global: Self) {
		this.clients.push(client);
		this.globals.set(global, client);
		this.documents.set(global.document, client);
		this.locations.set(global.location, client);
		this.histories.set(global.history, client);
		this.functions.set(global.Function, client);
		this.realms.set(global.Object.prototype, client);

		const names = Object_getOwnPropertyNames(global);
		for (let i = 0; i < names.length; i++) {
			const prop = names[i];
			const desc = Object_getOwnPropertyDescriptor(global, prop);
			if (desc && typeof desc.value === "function") {
				let ctors = this.ctors[prop];
				if (!ctors) {
					ctors = [];
					this.ctors[prop] = ctors;
				}
				ctors[ctors.length] = desc.value;
			}
		}
	}

	instanceof(obj: any, name: string): boolean {
		const ctors = this.ctors[name];
		if (!ctors) {
			dbg.error(`No constructors for ${name} found`);
			return false;
		}
		// not `instanceof`, which would run a page-defined
		// `Symbol.hasInstance` - and callers use the answer to decide whether a
		// value gets rewritten
		for (const ctor of ctors) {
			if (Function_hasInstance(ctor, obj)) return true;
		}
		return false;
	}
}
