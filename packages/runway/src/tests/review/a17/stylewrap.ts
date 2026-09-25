import { basicTest } from "../../../testcommon.ts";

// el.style (and CSSRule.style / SVG style) handed out as a Proxy wrapper.
// Exercise it the ways libraries do: natives called with it as receiver,
// natives from other realms, reflection, identity. Compared with bare Chrome.

export default [
	basicTest({
		name: "rv17-stylewrap",
		js: `
			const K = async (k, f) => {
				let v;
				try { v = await f(); } catch (e) { v = "THROW " + (e && e.name) + ": " + String(e && e.message).slice(0, 90); }
				if (v === undefined) v = "undefined";
				if (typeof v === "string") v = v.split(location.origin).join("O");
				assertConsistent(k, v);
			};
			const f1 = document.createElement("iframe"); document.body.append(f1);
			const HW = f1.contentWindow;              // hooked child
			const f2 = document.createElement("iframe"); document.body.append(f2);
			const UW = window[window.length - 1];     // unhooked child
			const CSD = CSSStyleDeclaration.prototype;
			const mk = () => { const d = document.createElement("div"); document.body.append(d); return d; };
			const st = document.createElement("style"); st.textContent = "b{color:red}"; document.head.append(st);
			const ruleStyle = () => st.sheet.cssRules[0].style;
			const svg = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "rect"); document.body.append(s); return s; };
			for (const [name, get] of Object.entries({ el: () => mk().style, rule: ruleStyle, svg: () => svg().style })) {
				await K(name + ".setPropertyCall", () => { const s = get(); CSD.setProperty.call(s, "color", "blue"); return s.color; });
				await K(name + ".getPropertyValueCall", () => { const s = get(); s.color = "green"; return CSD.getPropertyValue.call(s, "color"); });
				await K(name + ".removePropertyCall", () => { const s = get(); s.color = "green"; CSD.removeProperty.call(s, "color"); return s.color; });
				await K(name + ".cssTextSetterCall", () => { const s = get(); Object.getOwnPropertyDescriptor(CSD, "cssText").set.call(s, "color: pink"); return s.cssText; });
				await K(name + ".cssTextGetterCall", () => { const s = get(); s.color = "pink"; return Object.getOwnPropertyDescriptor(CSD, "cssText").get.call(s); });
				await K(name + ".lengthGetterCall", () => { const s = get(); s.color = "pink"; return Object.getOwnPropertyDescriptor(CSD, "length").get.call(s); });
				await K(name + ".itemCall", () => { const s = get(); s.color = "pink"; return CSD.item.call(s, 0); });
				await K(name + ".reflectGet", () => { const s = get(); s.color = "pink"; return Reflect.get(CSD, "cssText", s); });
				await K(name + ".hookedNative", () => { const s = get(); HW.CSSStyleDeclaration.prototype.setProperty.call(s, "color", "navy"); return s.color; });
				await K(name + ".hookedNativeGet", () => { const s = get(); s.color = "navy"; return HW.CSSStyleDeclaration.prototype.getPropertyValue.call(s, "color"); });
				await K(name + ".unhookedNative", () => { const s = get(); UW.CSSStyleDeclaration.prototype.setProperty.call(s, "color", "teal"); return s.color; });
				await K(name + ".unhookedCssText", () => { const s = get(); Object.getOwnPropertyDescriptor(UW.CSSStyleDeclaration.prototype, "cssText").set.call(s, "color: teal"); return s.cssText; });
				await K(name + ".methodThis", () => { const a = get(), b = get(); a.setProperty.call(b, "color", "red"); return [a.color, b.color].join(); });
				await K(name + ".toStringTag", () => Object.prototype.toString.call(get()));
				await K(name + ".proto", () => [Object.getPrototypeOf(get()) === CSD, Object.getPrototypeOf(get()).constructor.name].join());
				await K(name + ".instanceof", () => get() instanceof CSSStyleDeclaration);
				await K(name + ".keysLen", () => { const s = get(); s.color = "red"; return [Object.keys(s).length > 0, Object.keys(s).includes("0")].join(); });
				await K(name + ".forIn", () => { const s = get(); let n = 0; for (const k in s) if (k === "color") n++; return n; });
				await K(name + ".hasOwn", () => { const s = get(); return [Object.hasOwn(s, "color"), "color" in s, "backgroundImage" in s, "setProperty" in s].join(); });
				await K(name + ".bgUrl", () => { const s = get(); s.backgroundImage = "url(/a.png)"; return [s.backgroundImage, s.getPropertyValue("background-image"), s.cssText].join("|"); });
				await K(name + ".bgUrlSetProperty", () => { const s = get(); s.setProperty("background-image", "url(/b.png)"); return [s.backgroundImage, s.cssText].join("|"); });
				await K(name + ".customProp", () => { const s = get(); s.setProperty("--x", "url(/c.png)"); return [s.getPropertyValue("--x"), s.cssText].join("|"); });
				await K(name + ".weakmap", () => { const s = get(); const w = new WeakMap([[s, 1]]); return w.get(s); });
				await K(name + ".assign", () => { const s = get(); Object.assign(s, { color: "red", backgroundImage: "url(/d.png)" }); return s.cssText; });
				await K(name + ".definePropertyAccessor", () => { const s = get(); try { Object.defineProperty(s, "color", { get() { return "x"; }, configurable: true }); return s.color; } catch (e) { return e.name; } });
				await K(name + ".freeze", () => { try { Object.freeze(get()); return "ok"; } catch (e) { return e.name; } });
				await K(name + ".preventExtensions", () => { const s = get(); try { Object.preventExtensions(s); return Object.isExtensible(s); } catch (e) { return e.name; } });
				await K(name + ".setPrototype", () => { const s = get(); try { return Reflect.setPrototypeOf(s, CSD); } catch (e) { return e.name; } });
				await K(name + ".structuredClone", () => { try { structuredClone(get()); return "ok"; } catch (e) { return e.name; } });
				await K(name + ".postMessage", () => { try { postMessage(get(), "*"); return "ok"; } catch (e) { return e.name; } });
				await K(name + ".jsonStringifyKeys", () => { const s = get(); s.color = "red"; return JSON.stringify(s).includes('"0":"color"'); });
			}
			await K("attributeStyleMap.setCall", () => { const d = mk(); StylePropertyMap.prototype.set.call(d.attributeStyleMap, "color", "red"); return d.style.color; });
			await K("attributeStyleMap.unhooked", () => { const d = mk(); UW.StylePropertyMap.prototype.set.call(d.attributeStyleMap, "color", "red"); return d.style.color; });
			await K("computed.getPropertyValue", () => { const d = mk(); d.style.color = "red"; return CSD.getPropertyValue.call(getComputedStyle(d), "color"); });
			await K("computedStyleOfStyle", () => { const d = mk(); return typeof getComputedStyle(d).color; });
			await K("attributesNative", () => { const d = mk(); d.setAttribute("title", "t"); return [NamedNodeMap.prototype.getNamedItem.call(d.attributes, "title").value, UW.NamedNodeMap.prototype.getNamedItem.call(d.attributes, "title").value, Object.getOwnPropertyDescriptor(NamedNodeMap.prototype, "length").get.call(d.attributes)].join(); });
			await K("attributesUnhookedLen", () => { const d = mk(); d.setAttribute("title", "t"); return Object.getOwnPropertyDescriptor(UW.NamedNodeMap.prototype, "length").get.call(d.attributes); });
			await K("classListNative", () => { const d = mk(); DOMTokenList.prototype.add.call(d.classList, "a"); UW.DOMTokenList.prototype.add.call(d.classList, "b"); return d.className; });
			await K("datasetNative", () => { const d = mk(); d.dataset.x = "1"; return Object.prototype.toString.call(d.dataset) + JSON.stringify(Object.assign({}, d.dataset)); });
			await K("sandboxNative", () => { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; return [DOMTokenList.prototype.contains.call(f.sandbox, "allow-scripts"), UW.DOMTokenList.prototype.contains.call(f.sandbox, "allow-scripts"), f.sandbox.value].join(); });
			await K("relListNative", () => { const a = document.createElement("a"); a.rel = "noopener"; return UW.DOMTokenList.prototype.contains.call(a.relList, "noopener"); });
			await K("svgHrefNative", () => { const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#x"); return [Object.getOwnPropertyDescriptor(UW.SVGAnimatedString.prototype, "baseVal").get.call(u.href), u.href.baseVal].join(); });
		`,
	}),
];
