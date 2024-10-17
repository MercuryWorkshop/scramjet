import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: typeof window) {
	client.Trap("Element.prototype.attributes", {
		get(ctx) {
			const map = ctx.get() as NamedNodeMap;
			const proxy = new Proxy(map, {
				get(target, prop, receiver) {
					const value = Reflect.get(target, prop);

					if (prop === "length") {
						return Object.keys(proxy).length;
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
							apply(target, thisArg, argArray) {
								if (thisArg === proxy) {
									return Reflect.apply(target, map, argArray);
								}

								return Reflect.apply(target, thisArg, argArray);
							},
						});
					}

					if (!this.has(target, prop)) return undefined;

					if (value instanceof Attr) {
						const attr = value;

						return new Proxy(attr, {
							get(target, prop) {
								if (
									prop === "value" ||
									prop === "nodeValue" ||
									prop === "textContent"
								) {
									// we're using the proxied getAttribute here
									return target.ownerElement.getAttribute(target.name);
								}

								return Reflect.get(target, prop);
							},
							set(target, prop, value) {
								if (
									prop === "value" ||
									prop === "nodeValue" ||
									prop === "textContent"
								) {
									target.ownerElement.setAttribute(target.name, value);

									return true;
								}

								return Reflect.set(target, prop, value);
							},
						});
					}

					return value;
				},
				ownKeys(target) {
					const keys = Reflect.ownKeys(target);

					return keys.filter((key) => this.has(target, key));
				},
				has(target, prop) {
					if (typeof prop === "symbol") return Reflect.has(target, prop);
					if (prop.startsWith("data-scramjet-")) return false;
					if (map[prop]?.name?.startsWith("data-scramjet-")) return false;

					return Reflect.has(target, prop);
				},
			});

			return proxy;
		},
	});
}
