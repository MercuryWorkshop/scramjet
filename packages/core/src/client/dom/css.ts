import { rewriteCss, unrewriteCss } from "@rewriters/css";
import { ScramjetClient } from "@client/index";
import {
	Object_getOwnPropertyDescriptor,
	Object_getOwnPropertyNames,
	Reflect_apply,
	Reflect_defineProperty,
	Reflect_get,
	Reflect_set,
	Number_isInteger,
	_Map,
	_Set,
	_WeakMap,
} from "@/shared/snapshot";
import { Arguments, Returns, Type, idlDOMString } from "@client/webidl";
import { mirrorAttributeName } from "@client/attributes";

export default function (client: ScramjetClient, self: Self) {
	const rewrite = (css: string) => rewriteCss(css, client.context, client.meta);
	const unrewrite = (css: string) => unrewriteCss(css, client.context);
	const attrs = client.attributes;
	const STYLE_MIRROR = mirrorAttributeName("style");

	/**
	 * After a write through an element's inline style - CSSOM or typed OM -
	 * bring its `style` mirror into line with what the write left behind.
	 *
	 * The write changes the attribute the document holds and nothing else, so
	 * a mirror recorded by an earlier `setAttribute` or by the parser would go
	 * on answering `getAttribute("style")` with the value before it. And an
	 * element that had no style attribute at all now has one carrying
	 * rewritten URLs and no mirror to hide them. Either way the page is owed
	 * the serialization the engine produced, with its URLs as the page wrote
	 * them.
	 */
	const touched = (declaration: object) => {
		const owner = client.box.inlineStyleOwners.get(declaration);
		if (!owner) return;

		const current = attrs.raw.get(owner, "style");
		if (current === null) attrs.raw.remove(owner, STYLE_MIRROR);
		else attrs.raw.set(owner, STYLE_MIRROR, unrewrite(current));
	};

	// https://drafts.csswg.org/cssom/#the-cssstyledeclaration-interface
	client.Intercept(class extends CSSStyleDeclaration {
		@Arguments("CSSOMString")
		@Returns("CSSOMString")
		getPropertyValue(property: string): string {
			const value = super.getPropertyValue(property);

			return value ? unrewrite(value) : value;
		}

		// needs the unrewrite - it returns the value it removed
		@Arguments("CSSOMString")
		@Returns("CSSOMString")
		removeProperty(property: string): string {
			const removed = super.removeProperty(property);
			touched(this);

			return removed ? unrewrite(removed) : removed;
		}

		// the empty string is not a value to rewrite, it is the spec's signal
		// to remove the property, so it has to pass through untouched.
		// `priority` defaults to "" in the IDL; the parser discards defaults, so
		// it is not spelled out here
		@Arguments(
			"CSSOMString",
			"[LegacyNullToEmptyString] CSSOMString",
			"optional [LegacyNullToEmptyString] CSSOMString priority"
		)
		@Returns("undefined")
		setProperty(property: string, value: string, priority?: string): void {
			super.setProperty(property, value ? rewrite(value) : value, priority);
			touched(this);
		}

		@Type("[LegacyNullToEmptyString] CSSOMString")
		get cssText(): string {
			return unrewrite(super.cssText);
		}

		@Type("[LegacyNullToEmptyString] CSSOMString")
		set cssText(value: string) {
			super.cssText = rewrite(value);
			touched(this);
		}
	});

	// https://drafts.csswg.org/cssom/#the-cssstylesheet-interface
	client.Intercept(class extends CSSStyleSheet {
		@Arguments("CSSOMString", "optional unsigned long index = 0")
		@Returns("unsigned long")
		insertRule(rule: string, index?: number): number {
			return super.insertRule(rewrite(rule), index);
		}

		/**
		 * Blink's legacy alias for `insertRule`, spelled as a whole rule split
		 * in two. `style` is a declaration block body and carries `url()` just
		 * as `insertRule`'s does, so it needs the same rewrite - without this
		 * it was the one way left to get an unrewritten URL into a stylesheet.
		 * Absent on an engine that does not have it, which `Intercept` skips.
		 */
		@Arguments(
			"optional DOMString",
			"optional DOMString",
			"optional unsigned long"
		)
		@Returns("long")
		addRule(selector?: string, style?: string, index?: number): number {
			return super.addRule(selector, style ? rewrite(style) : style, index);
		}

		@Arguments("USVString")
		@Returns("Promise<CSSStyleSheet>")
		async replace(text: string): Promise<CSSStyleSheet> {
			return super.replace(rewrite(text));
		}

		@Arguments("USVString")
		@Returns("undefined")
		replaceSync(text: string): void {
			super.replaceSync(rewrite(text));
		}
	});

	client.Intercept(class extends CSSRule {
		@Type("CSSOMString")
		get cssText(): string {
			return unrewrite(super.cssText);
		}
	});

	// https://drafts.css-houdini.org/css-typed-om-1/#cssstylevalue
	if ("CSSStyleValue" in self) {
		client.Intercept(class extends CSSStyleValue {
			@Arguments("USVString", "USVString")
			@Returns("CSSStyleValue")
			static parse(property: string, cssText: string): CSSStyleValue {
				return super.parse(property, cssText ? rewrite(cssText) : cssText);
			}

			@Arguments("USVString", "USVString")
			@Returns("sequence<CSSStyleValue>")
			static parseAll(property: string, cssText: string): CSSStyleValue[] {
				return super.parseAll(property, cssText ? rewrite(cssText) : cssText);
			}
		});
	}

	/**
	 * Blink installs the ~740 CSS property attributes as own properties of every
	 * declaration - `CSSStyleDeclaration.prototype` has ten own keys and not one
	 * of them is a CSS property. There is no shared accessor to intercept, so a
	 * declaration handed to the page has to be wrapped per instance.
	 *
	 * What the wrapper must not be is a guess. The classification below is
	 * exact: a key names a CSS attribute iff the declaration reports it as its
	 * own and it is not an array index. That is the browser's own installation
	 * answering the question, so it covers camelCase, the dashed spelling and
	 * both vendor-prefix casings with no list to keep in sync, and it excludes
	 * page-set expandos, which the previous `in CSSStyleDeclaration.prototype`
	 * test silently ran through the CSS un-rewriter.
	 */
	const isIndex = (prop: string) => {
		const n = +prop;

		return Number_isInteger(n) && n >= 0 && `${n}` === prop;
	};

	const toCssValue = (value: unknown) =>
		value === null ? "" : idlDOMString(value);

	/**
	 * The CSS attribute names carried by each kind of declaration, taken once
	 * from the first one of that kind we are handed.
	 *
	 * Testing `Object.hasOwn` per access does not work: an expando becomes an
	 * own property the moment it is written, so `el.style.mine = "x"` is a CSS
	 * attribute from the second read onwards and the page's own string goes
	 * back through the CSS un-rewriter. Remembering the expandos instead has a
	 * worse failure: it caches a *negative* verdict, so any name that is
	 * momentarily not own is poisoned for the life of the declaration and stops
	 * being rewritten at all.
	 *
	 * A snapshot has neither problem. It is also per *kind* rather than per
	 * declaration: the set runs to ~740 names, and one copy per wrapped
	 * declaration would cost more than the page's own style objects. The kind
	 * is the interface handing the declaration out, which each `style`
	 * interceptor below already names in its `@Type` - so a
	 * `CSSFontFaceDescriptors` brings `src` and a `CSSMarginDescriptors` brings
	 * its own set, with no list here to keep in sync with any of them.
	 *
	 * The declaration it is taken from is pristine: every path to one goes
	 * through a `style` getter below, and the snapshot happens on the first of
	 * those, so the page has never held it. Array indices are dropped - a rule
	 * that already has declarations carries some, and they are not attributes.
	 */
	const cssAttributesByKind = new _Map<string, _Set<string>>();

	const cssAttributesFor = (kind: string, style: CSSStyleDeclaration) => {
		const cached = cssAttributesByKind.get(kind);
		if (cached) return cached;

		const names = new _Set<string>();
		const own = Object_getOwnPropertyNames(style);
		for (let i = 0; i < own.length; i++) {
			if (!isIndex(own[i])) names.add(own[i]);
		}
		cssAttributesByKind.set(kind, names);

		return names;
	};

	const wrapStyleDeclaration = (kind: string, style: CSSStyleDeclaration) => {
		const cssAttributes = cssAttributesFor(kind, style);

		/**
		 * One wrapper per underlying function, so `style.setProperty` is the
		 * same object on every read as it is natively. A fresh Proxy per read
		 * makes `el.style.setProperty !== el.style.setProperty`, which is both
		 * a one-expression tell and a break for anything that caches a method.
		 */
		const methods = new _WeakMap<object, any>();

		const isAttribute = (prop: string | symbol) =>
			typeof prop === "string" && cssAttributes.has(prop);

		return new Proxy(style, {
			get(target, prop) {
				const value = Reflect_get(target, prop);

				if (isAttribute(prop)) return value ? unrewrite(value) : value;

				if (typeof value === "function") {
					const cached = methods.get(value);
					if (cached) return cached;

					const wrapped = new Proxy(value, {
						apply: (fn, _that, args) => Reflect_apply(fn, target, args),
					});
					methods.set(value, wrapped);

					return wrapped;
				}

				return value;
			},

			set(target, prop, value) {
				if (!isAttribute(prop)) return Reflect_set(target, prop, value);

				const css = toCssValue(value);

				// the empty string is the spec's signal to remove the property,
				// not something to rewrite
				const result = Reflect_set(target, prop, css ? rewrite(css) : css);
				touched(target);

				return result;
			},

			getOwnPropertyDescriptor(target, prop) {
				const desc = Object_getOwnPropertyDescriptor(target, prop);
				if (!desc || !isAttribute(prop)) return desc;

				if (desc.value) desc.value = unrewrite(desc.value);

				return desc;
			},

			defineProperty(target, prop, desc) {
				if (!isAttribute(prop) || !("value" in desc)) {
					return Reflect_defineProperty(target, prop, desc);
				}

				const css = toCssValue(desc.value);

				const result = Reflect_defineProperty(target, prop, {
					...desc,
					value: css ? rewrite(css) : css,
				});
				touched(target);

				return result;
			},
		});
	};

	/**
	 *   correct but extremely expensive proxy
	 *
	 *   client.Intercept(class extends GlobalScope {
	 *     @Arguments("Element", "optional CSSOMString?")
	 *     @Returns("CSSStyleDeclaration")
	 *     static getComputedStyle(elt: Element, pseudoElt?: string | null) {
	 *       return wrapStyleDeclaration(
	 *         "CSSStyleProperties",
	 *         nGlobal.getComputedStyle(elt, pseudoElt)
	 *       );
	 *     }
	 *   });
	 */

	/**
	 * Every `style` attribute is `[SameObject, PutForwards=cssText]`, so deduplicate it here
	 *
	 * `PutForwards=cssText` is why none of the interceptors below declare a
	 * setter: writing `el.style = "..."` is defined as writing
	 * `el.style.cssText`, the native setter already does exactly that, and
	 * `Intercept` leaves the half an interceptor doesn't declare alone. The
	 * write then lands on the `cssText` interceptor above, which rewrites it.
	 */
	const inlineStyle = (kind: string, declaration: CSSStyleDeclaration) => {
		let wrapper = client.box.styleDeclarations.get(declaration);
		if (!wrapper) {
			wrapper = wrapStyleDeclaration(kind, declaration);
			client.box.styleDeclarations.set(declaration, wrapper);
		}

		return wrapper;
	};

	/** An element's own inline declaration, remembered as belonging to it. */
	const elementStyle = (element: Element, declaration: CSSStyleDeclaration) => {
		client.box.inlineStyleOwners.set(declaration, element);

		return inlineStyle("CSSStyleProperties", declaration);
	};

	/** An element's typed OM view of the same attribute. */
	const elementStyleMap = (element: Element, map: StylePropertyMap) => {
		client.box.inlineStyleOwners.set(map, element);

		return map;
	};

	client.Intercept(class extends HTMLElement {
		@Type("CSSStyleProperties")
		get style(): CSSStyleDeclaration {
			return elementStyle(this, super.style);
		}

		@Type("StylePropertyMap")
		get attributeStyleMap(): StylePropertyMap {
			return elementStyleMap(this, super.attributeStyleMap);
		}
	});

	client.Intercept(class extends SVGElement {
		@Type("CSSStyleProperties")
		get style(): CSSStyleDeclaration {
			return elementStyle(this, super.style);
		}

		@Type("StylePropertyMap")
		get attributeStyleMap(): StylePropertyMap {
			return elementStyleMap(this, super.attributeStyleMap);
		}
	});

	if ("MathMLElement" in self) {
		client.Intercept(class extends MathMLElement {
			@Type("CSSStyleProperties")
			get style(): CSSStyleDeclaration {
				return elementStyle(this, super.style);
			}

			@Type("StylePropertyMap")
			get attributeStyleMap(): StylePropertyMap {
				return elementStyleMap(this, super.attributeStyleMap);
			}
		});
	}

	/**
	 * https://drafts.css-houdini.org/css-typed-om-1/#stylepropertymap - the
	 * typed OM's write half. A string value is parsed as CSS exactly the way
	 * `setProperty`'s is, so it gets the same rewrite; a `CSSStyleValue` was
	 * already rewritten when `CSSStyleValue.parse` built it. The map an
	 * element hands out writes that element's style attribute.
	 */
	if ("StylePropertyMap" in self) {
		const rewriteValues = (values: (CSSStyleValue | string)[]) => {
			const out: (CSSStyleValue | string)[] = [];
			for (let i = 0; i < values.length; i++) {
				const value = values[i];
				out[i] = typeof value === "string" && value ? rewrite(value) : value;
			}

			return out;
		};

		client.Intercept(class extends StylePropertyMap {
			@Arguments("USVString", "(CSSStyleValue or USVString)...")
			@Returns("undefined")
			set(property: string, ...values: (CSSStyleValue | string)[]): void {
				super.set(property, ...rewriteValues(values));
				touched(this);
			}

			@Arguments("USVString", "(CSSStyleValue or USVString)...")
			@Returns("undefined")
			append(property: string, ...values: (CSSStyleValue | string)[]): void {
				super.append(property, ...rewriteValues(values));
				touched(this);
			}

			@Arguments("USVString")
			@Returns("undefined")
			delete(property: string): void {
				super.delete(property);
				touched(this);
			}

			@Arguments()
			@Returns("undefined")
			clear(): void {
				super.clear();
				touched(this);
			}
		});
	}

	client.Intercept(class extends CSSStyleRule {
		@Type("CSSStyleProperties")
		get style(): CSSStyleDeclaration {
			return inlineStyle("CSSStyleProperties", super.style);
		}
	});

	client.Intercept(class extends CSSPageRule {
		@Type("CSSStyleProperties")
		get style(): CSSStyleDeclaration {
			return inlineStyle("CSSStyleProperties", super.style);
		}
	});

	if ("CSSMarginRule" in self) {
		client.Intercept(class extends CSSMarginRule {
			@Type("CSSMarginDescriptors")
			// eslint-disable-next-line scramjet-core/intercept-brand-check -- reads super.style on every path; CSSMarginRule is missing from lib.dom
			get style(): CSSStyleDeclaration {
				return inlineStyle("CSSMarginDescriptors", super.style);
			}
		});
	}

	if ("CSSNestedDeclarations" in self) {
		client.Intercept(class extends CSSNestedDeclarations {
			@Type("CSSStyleProperties")
			get style(): CSSStyleDeclaration {
				return inlineStyle("CSSStyleProperties", super.style);
			}
		});
	}

	client.Intercept(class extends CSSKeyframeRule {
		@Type("CSSStyleProperties")
		get style(): CSSStyleDeclaration {
			return inlineStyle("CSSStyleProperties", super.style);
		}
	});

	client.Intercept(class extends CSSFontFaceRule {
		@Type("CSSFontFaceDescriptors")
		get style(): CSSStyleDeclaration {
			return inlineStyle("CSSFontFaceDescriptors", super.style);
		}
	});

	if ("CSSPositionTryRule" in self) {
		client.Intercept(class extends CSSPositionTryRule {
			@Type("CSSPositionTryDescriptors")
			// eslint-disable-next-line scramjet-core/intercept-brand-check -- reads super.style on every path; CSSPositionTryRule is missing from lib.dom
			get style(): CSSStyleDeclaration {
				return inlineStyle("CSSPositionTryDescriptors", super.style);
			}
		});
	}
}
