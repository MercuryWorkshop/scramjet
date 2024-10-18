import { ScramjetClient } from "../client";
import { rewriteCss, unrewriteCss } from "../../shared";

const cssProperties = [
	"background",
	"background-image",
	"mask",
	"mask-image",
	"list-style",
	"list-style-image",
	"border-image",
	"border-image-source",
	"cursor",
];

export default function (client: ScramjetClient) {
	client.Proxy("CSSStyleDeclaration.prototype.setProperty", {
		apply(ctx) {
			if (cssProperties.includes(ctx.args[0]))
				ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});

	client.Proxy("CSSStyleDeclaration.prototype.getPropertyValue", {
		apply(ctx) {
			if (cssProperties.includes(ctx.args[0])) {
				const realProperty = ctx.call();

				return ctx.return(unrewriteCss(realProperty));
			}
		},
	});

	client.Trap("CSSStyleDeclaration.prototype.cssText", {
		set(ctx, value: string) {
			ctx.set(rewriteCss(value, client.meta));
		},
		get(ctx) {
			return unrewriteCss(ctx.get());
		},
	});

	client.Trap("HTMLElement.prototype.style", {
		get(ctx) {
			// unfortunate and dumb hack. we have to trap every property of this
			// since the prototype chain is fucked

			const style = ctx.get() as CSSStyleDeclaration;

			return new Proxy(style, {
				get(t, p) {
					const v = Reflect.get(t, p);

					if (typeof v === "function") {
						return new Proxy(v, {
							apply(target, thisArg, argArray) {
								return Reflect.apply(target, style, argArray);
							},
						});
					}

					if (p in CSSStyleDeclaration.prototype) return v;
					if (!v) return v;

					return unrewriteCss(v);
				},
				set(t, p, v) {
					if (p == "cssText" || v == "" || typeof v !== "string") {
						return Reflect.set(t, p, v);
					}

					return Reflect.set(t, p, rewriteCss(v, client.meta));
				},
			});
		},
		set(ctx, v: string) {
			// this will actually run the trap for cssText. don't rewrite it here
			ctx.set(v);
		},
	});

	client.Proxy("CSSStyleDeclaration.prototype.getPropertyValue", {
		apply(ctx) {
			const v = ctx.call();
			if (!v) return v;
			ctx.return(unrewriteCss(v));
		},
	});
	client.Proxy("CSSStyleDeclaration.prototype.setProperty", {
		apply(ctx) {
			if (!ctx.args[1]) return;
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});
}
