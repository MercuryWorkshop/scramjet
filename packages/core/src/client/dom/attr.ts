import { ScramjetClient } from "@client/index";
import {
	Number,
	Object_keys,
	Reflect_apply,
	Reflect_get,
	Reflect_has,
	Reflect_ownKeys,
} from "@/shared/snapshot";

export default function (client: ScramjetClient) {
	client.Trap("Element.prototype.attributes", {
		get(ctx) {
			const map = ctx.get() as NamedNodeMap;
			const proxy = new Proxy(map, {
				get(target, prop, _receiver) {
					const value = Reflect_get(target, prop);

					if (prop === "length") {
						return Object_keys(proxy).length;
					}

					if (prop === "getNamedItem") {
						return (name: string) => proxy[name];
					}
					if (prop === "getNamedItemNS") {
						return (namespace: string, name: string) =>
							proxy[`${namespace}:${name}`];
					}

					if (prop in NamedNodeMap.prototype && typeof value === "function") {
						return new Proxy(value, {
							apply(target, that, args) {
								if (that === proxy) {
									return Reflect_apply(target, map, args);
								}

								return Reflect_apply(target, that, args);
							},
						});
					}

					if (
						(typeof prop === "string" || typeof prop === "number") &&
						!isNaN(Number(prop))
					) {
						const position = Object_keys(proxy)[prop];

						return map[position];
					}

					if (!this.has(target, prop)) return undefined;

					return value;
				},
				ownKeys(target) {
					const keys = Reflect_ownKeys(target);

					return keys.filter((key) => this.has(target, key));
				},
				has(target, prop) {
					if (typeof prop === "symbol") return Reflect_has(target, prop);
					if (prop.startsWith("scramjet-attr-")) return false;
					if (map[prop]?.name?.startsWith("scramjet-attr-")) return false;

					return Reflect_has(target, prop);
				},
			});

			return proxy;
		},
	});

	client.Trap(["Attr.prototype.value", "Attr.prototype.nodeValue"], {
		get(ctx) {
			if (ctx.this?.ownerElement) {
				return ctx.this.ownerElement.getAttribute(ctx.this.name);
			}

			return ctx.get();
		},
		set(ctx, value) {
			if (ctx.this?.ownerElement) {
				return ctx.this.ownerElement.setAttribute(ctx.this.name, value);
			}

			return ctx.set(value);
		},
	});
}
