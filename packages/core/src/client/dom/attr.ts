/**
 * `Attr` and `NamedNodeMap` - the other two ways to reach an attribute.
 *
 * Everything here is the same mirror the `Element` members in `dom/element.ts`
 * present, seen from the node side: an `Attr` answers with its element's mirror
 * rather than with what the document holds, a mirror that stands in for an
 * attribute a rule removed answers under that attribute's name, and the map
 * lists exactly what `getAttributeNames` lists.
 *
 * The map is the one place a Proxy is unavoidable. Its indices and named
 * properties are exotic - the browser generates them from the attribute list,
 * which contains our mirrors - so they cannot be intercepted as members. Its
 * *methods* can, and are, and they accept the wrapper as their receiver - so
 * `el.attributes.getNamedItem` is `NamedNodeMap.prototype.getNamedItem`, the
 * way it is natively, rather than a per-wrapper copy.
 *
 * https://dom.spec.whatwg.org/#interface-namednodemap
 * https://dom.spec.whatwg.org/#interface-attr
 */

import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import {
	isInternalAttribute,
	mirrorAttributeName,
	mirroredAttributeName,
	nullNamespace,
} from "@client/attributes";
import {
	Number,
	Number_isInteger,
	Object_getOwnPropertyDescriptor,
	Object_getPrototypeOf,
	Reflect_get,
	Reflect_has,
	Reflect_ownKeys,
	String,
	Symbol_iterator,
	_Map,
	drain,
} from "@/shared/snapshot";

/**
 * The position `prop` names in the map, or -1 when it does not name one.
 *
 * A property key is an index only if it is the *canonical* spelling of one, so
 * that "01", " 1" and "1e0" stay ordinary property names the way they do on an
 * array. Round-tripping the number back to a string is what tests that.
 */
function indexOf(prop: string | symbol): number {
	if (typeof prop !== "string") return -1;

	const index = Number(prop);
	if (!Number_isInteger(index) || index < 0) return -1;

	return `${index}` === prop ? index : -1;
}

export default function (client: ScramjetClient, _self: Self) {
	const attrs = client.attributes;

	/**
	 * The real map behind `map`, which is the wrapper whenever the page called
	 * a method off `el.attributes`. Every native below is applied to this: a
	 * Proxy carries none of the internal slots the natives brand check for.
	 */
	const real = (map: NamedNodeMap): NamedNodeMap =>
		client.box.attributeMapTargets.get(map) ?? map;

	/**
	 * The element a map belongs to.
	 *
	 * Recorded when the map is handed out, because `NamedNodeMap` exposes no way
	 * back to its element and an empty map has no attribute to ask. The fallback
	 * covers a map that reached us another way: any map with something in it can
	 * be traced through its first attribute, and one with nothing in it has
	 * nothing for the mirror layer to say about it either.
	 */
	const ownerOf = (map: NamedNodeMap): Element | null => {
		map = real(map);
		const known = client.box.attributeOwners.get(map);
		if (known) return known;

		const first: Attr | null = new client.native.NamedNodeMap(map).item(0);

		return first ? attrs.owner(first) : null;
	};

	/** The attribute at `index` of what the page can see. */
	const itemAt = (map: NamedNodeMap, index: number): Attr | null => {
		const element = ownerOf(map);
		if (!element) return new client.native.NamedNodeMap(real(map)).item(index);

		const nodes = attrs.nodes(element);

		return index < nodes.length ? nodes[index] : null;
	};

	/**
	 * The wrapper the page is handed for `element.attributes`.
	 *
	 * Only the exotic half is implemented here. Every method and `length` falls
	 * through to the prototype, where the interceptors below answer in terms of
	 * the visible list and unwrap their receiver to the real map.
	 */
	const wrap = (element: Element, map: NamedNodeMap): NamedNodeMap => {
		const prototype = Object_getPrototypeOf(map);

		/** The `Attr` for a named property, or null when `prop` is not one. */
		const named = (prop: string | symbol): Attr | null => {
			if (typeof prop !== "string") return null;
			// a property the object or its prototype chain already has is not a
			// named property at all - which is why `attributes.length` is the
			// count even on an element carrying a `length` attribute
			// https://webidl.spec.whatwg.org/#dfn-named-property-visibility
			if (Reflect_has(prototype, prop)) return null;
			if (indexOf(prop) !== -1) return null;

			return attrs.node(element, prop);
		};

		const wrapper = new Proxy(map, {
			// deliberately not forwarding the receiver: it is this proxy, and a
			// native accessor called with a proxy as its receiver fails its own
			// brand check. `length` is an accessor
			get(target, prop) {
				if (prop === Symbol_iterator || prop === "values") {
					return function* (this: NamedNodeMap) {
						const owner = ownerOf(brand(this));
						if (!owner) {
							// indexed through the native, not by running the native
							// iterator: `for...of` over it reads `next` and
							// @@iterator off prototypes the page can replace.
							// `length` is read every step, as the live iterator does
							const native = new client.native.NamedNodeMap(real(this));
							for (let i = 0; i < native.length; i++) yield native.item(i)!;
							return;
						}
						const nodes = attrs.nodes(owner);
						for (const node of drain(nodes)) yield node;
					};
				}

				const index = indexOf(prop);
				if (index !== -1) return itemAt(target, index) ?? undefined;

				const attr = named(prop);
				if (attr) return attr;
				// a mirror, or anything else of ours that the native would answer
				// with under its real name
				if (typeof prop === "string" && isInternalAttribute(prop)) {
					return undefined;
				}

				// the receiver is the target, not this proxy: `length` is an
				// accessor, and the interceptor behind it unwraps either way
				return Reflect_get(target, prop);
			},

			has(target, prop) {
				const index = indexOf(prop);
				if (index !== -1) return index < attrs.names(element).length;
				if (named(prop)) return true;
				if (typeof prop === "string" && isInternalAttribute(prop)) return false;

				return Reflect_has(target, prop);
			},

			ownKeys(target) {
				const names = attrs.names(element);
				const keys: (string | symbol)[] = [];
				const seen = new _Map<string, true>();

				// an attribute named "0" is already listed as the index it shares
				// its key with, and a key listed twice breaks the proxy invariant
				for (let i = 0; i < names.length; i++) {
					keys[keys.length] = String(i);
					seen.set(String(i), true);
				}
				for (const name of drain(names)) {
					if (seen.get(name)) continue;
					seen.set(name, true);
					keys[keys.length] = name;
				}
				// anything the native owns that is neither an index nor an
				// attribute name. there is nothing in practice, but a key that
				// exists and is left out of `ownKeys` is a proxy invariant
				// violation waiting to happen
				const own = Reflect_ownKeys(target);
				for (const key of drain(own)) {
					if (typeof key !== "string") {
						keys[keys.length] = key;
						continue;
					}
					if (
						indexOf(key) !== -1 ||
						seen.get(key) ||
						isInternalAttribute(key)
					) {
						continue;
					}
					if (attrs.node(element, key)) continue;
					keys[keys.length] = key;
				}

				return keys;
			},

			getOwnPropertyDescriptor(target, prop) {
				const index = indexOf(prop);
				if (index !== -1) {
					const attr = itemAt(target, index);
					if (!attr) return undefined;

					return {
						value: attr,
						writable: false,
						// an indexed property is enumerable; a named one is not,
						// because NamedNodeMap is [LegacyUnenumerableNamedProperties]
						enumerable: true,
						configurable: true,
					};
				}

				const attr = named(prop);
				if (attr) {
					return {
						value: attr,
						writable: false,
						enumerable: false,
						configurable: true,
					};
				}

				if (typeof prop === "string" && isInternalAttribute(prop)) {
					return undefined;
				}

				return Object_getOwnPropertyDescriptor(target, prop);
			},
		});
		client.box.attributeMapTargets.set(wrapper, map);

		return wrapper;
	};

	client.Intercept(class extends Element {
		@Type("NamedNodeMap")
		get attributes(): NamedNodeMap {
			const map = super.attributes;

			let wrapper = client.box.attributeMaps.get(map);
			if (!wrapper) {
				wrapper = wrap(this, map);
				client.box.attributeMaps.set(map, wrapper);
				client.box.attributeOwners.set(map, this);
			}

			return wrapper;
		}
	});

	/** The brand check every map member owes, run on the real map. */
	const brand = (map: NamedNodeMap): NamedNodeMap => {
		const target = real(map);
		void new client.native.NamedNodeMap(target).length;

		return target;
	};

	// https://dom.spec.whatwg.org/#interface-namednodemap
	//
	/* eslint-disable scramjet-core/intercept-brand-check --
	   none of these can call `super`: `this` is the wrapper whenever the method
	   was reached through `el.attributes`, and a Proxy fails every native's
	   brand check. `brand(this)` runs the native `length` getter on the map
	   behind it first thing on every path, which is the same check. */
	client.Intercept(class extends NamedNodeMap {
		@Type("unsigned long")
		get length(): number {
			const map = brand(this);
			const element = ownerOf(map);
			if (!element) return new client.native.NamedNodeMap(map).length;

			return attrs.names(element).length;
		}

		@Arguments("unsigned long")
		@Returns("Attr?")
		item(index: number): Attr | null {
			return itemAt(brand(this), index);
		}

		@Arguments("DOMString")
		@Returns("Attr?")
		getNamedItem(qualifiedName: string): Attr | null {
			const map = brand(this);
			const element = ownerOf(map);
			if (!element)
				return new client.native.NamedNodeMap(map).getNamedItem(qualifiedName);

			return attrs.node(element, attrs.qualify(element, qualifiedName));
		}

		@Arguments("DOMString?", "DOMString")
		@Returns("Attr?")
		getNamedItemNS(namespace: string | null, localName: string): Attr | null {
			namespace = nullNamespace(namespace);
			const map = brand(this);
			const node: Attr | null = new client.native.NamedNodeMap(
				map
			).getNamedItemNS(namespace, localName);
			if (node) return isInternalAttribute(attrs.attrName(node)) ? null : node;

			const element = ownerOf(map);
			if (!element || namespace) return null;

			return attrs.strippedNode(element, localName);
		}

		@Arguments("Attr")
		@Returns("Attr?")
		setNamedItem(attr: Attr): Attr | null {
			const map = brand(this);
			const element = ownerOf(map);
			if (!element)
				return new client.native.NamedNodeMap(map).setNamedItem(attr);

			// the same operation as `Element.setAttributeNode`, under another
			// name, so it goes through the same rewrite
			return attrs.insertNode(element, attr, false);
		}

		@Arguments("Attr")
		@Returns("Attr?")
		setNamedItemNS(attr: Attr): Attr | null {
			const map = brand(this);
			const element = ownerOf(map);
			if (!element)
				return new client.native.NamedNodeMap(map).setNamedItemNS(attr);

			return attrs.insertNode(element, attr, true);
		}

		@Arguments("DOMString")
		@Returns("Attr")
		removeNamedItem(qualifiedName: string): Attr {
			const map = brand(this);
			const element = ownerOf(map);
			if (!element)
				return new client.native.NamedNodeMap(map).removeNamedItem(
					qualifiedName
				);
			if (isInternalAttribute(qualifiedName)) {
				return new client.native.NamedNodeMap(map).removeNamedItem(
					"scramjet-attr"
				);
			}

			const name = attrs.qualify(element, qualifiedName);
			const node = attrs.node(element, name);
			// nothing visible under that name: hand it to the native, which
			// throws the spec's NotFoundError
			if (!node)
				return new client.native.NamedNodeMap(map).removeNamedItem(name);
			// a stripped attribute, which only its mirror represents
			if (
				attrs.nativeOwner(node) === null ||
				isInternalAttribute(attrs.attrName(node))
			) {
				return attrs.removeStripped(element, name)!;
			}

			const mirror = attrs.raw.get(element, mirrorAttributeName(name));
			const removed: Attr = new client.native.NamedNodeMap(map).removeNamedItem(
				attrs.attrName(node)
			);
			attrs.raw.remove(element, mirrorAttributeName(name));
			attrs.detached(removed, mirror);
			attrs.changed(element, name, null);

			return removed;
		}

		@Arguments("DOMString?", "DOMString")
		@Returns("Attr")
		removeNamedItemNS(namespace: string | null, localName: string): Attr {
			namespace = nullNamespace(namespace);
			const map = brand(this);
			const element = ownerOf(map);
			const node: Attr | null = new client.native.NamedNodeMap(
				map
			).getNamedItemNS(namespace, localName);

			if (element && node) {
				const name = attrs.heldName(element, node);
				if (!isInternalAttribute(name)) {
					const mirror = attrs.mirrorOf(element, node);
					if (mirror !== null) {
						attrs.raw.remove(element, mirrorAttributeName(name));
					}
					const removed: Attr = new client.native.NamedNodeMap(
						map
					).removeNamedItemNS(namespace, localName);
					attrs.detached(removed, mirror);
					if (namespace === null) attrs.changed(element, name, null);

					return removed;
				}
			}

			// a stripped attribute is represented by its mirror alone, which has
			// no namespace and a name the native would never match
			if (element && !node && namespace === null) {
				if (attrs.strippedNode(element, localName)) {
					return attrs.removeStripped(element, localName)!;
				}
			}

			// an internal attribute, or nothing at all: either way the page is
			// owed the NotFoundError for a name it cannot see
			return new client.native.NamedNodeMap(map).removeNamedItemNS(
				namespace,
				isInternalAttribute(localName) ? "" : localName
			);
		}
	});
	/* eslint-enable scramjet-core/intercept-brand-check */

	// https://dom.spec.whatwg.org/#interface-attr
	client.Intercept(class extends Attr {
		@Type("DOMString")
		get name(): string {
			const name = super.name;
			const mirrored = mirroredAttributeName(name);

			// "" is an internal attribute standing in for nothing, which is never
			// handed to the page in the first place; renaming it would only make
			// it harder to recognize in a debugger
			return mirrored ? mirrored : name;
		}

		@Type("DOMString")
		get localName(): string {
			const name = super.name;
			const mirrored = mirroredAttributeName(name);

			// a mirror is written without a namespace, so its local name and its
			// qualified name are the same string
			return mirrored ? mirrored : super.localName;
		}

		// a stripped attribute the page inserted as a node never reaches the
		// document, and belongs to its element only as far as the page can tell
		@Type("Element?")
		get ownerElement(): Element | null {
			void super.name;

			return attrs.owner(this);
		}

		@Type("DOMString")
		get value(): string {
			void super.name;

			return attrs.visibleValue(this);
		}

		@Type("DOMString")
		set value(value: string) {
			void super.name;

			attrs.setVisibleValue(this, String(value));
		}
	});
}
