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
} from "@/shared/snapshot";

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
		_Map<string, _WeakMap<(...args: any) => any, (...args: any) => any>>
	> = new _WeakMap();
	// real events that we're wrapping in event.ts
	wrappedEvents: _WeakMap<Event, Event> = new _WeakMap();
	// fake events that scramjet synthesized
	trustedEvents: _WeakSet<Event> = new _WeakSet();
	eventhandlers: _WeakMap<object, _Map<string, (...args: any) => any>> =
		new _WeakMap();

	unproxy: _Map<any, any> = new _Map([]);
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
		for (const ctor of ctors) {
			// eslint-disable-next-line scramjet-core/no-instanceof
			if (obj instanceof ctor) return true;
		}
		return false;
	}
}
