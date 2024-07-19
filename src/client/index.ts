import { decodeUrl } from "./shared";

declare global {
	interface Window {
		$s: any;
		$sImport: any;
	}
}

type ProxyCtx = {
	fn: Function;
	this: any;
	args: any[];
	newTarget: Function;
	return: (r: any) => void;
};

class ScramjetClient {
	Proxy(
		target: any,
		prop: string,
		handler: {
			construct?(ctx: ProxyCtx): any;
			apply?(ctx: ProxyCtx): any;
		}
	) {
		const value = Reflect.get(target, prop);
		delete target[prop];

		const h: ProxyHandler<any> = {};

		if (handler.construct) {
			h.construct = function (
				target: any,
				argArray: any[],
				newTarget: Function
			) {
				let returnValue: any = null;

				const ctx: ProxyCtx = {
					fn: target,
					this: null,
					args: argArray,
					newTarget: newTarget,
					return: (r: any) => {
						returnValue = r;
					},
				};

				handler.construct(ctx);

				if (returnValue) {
					return returnValue;
				}

				return Reflect.construct(ctx.fn, ctx.args, ctx.newTarget);
			};
		}

		if (handler.apply) {
			h.apply = function (target: any, thisArg: any, argArray: any[]) {
				let returnValue: any = null;

				const ctx: ProxyCtx = {
					fn: target,
					this: thisArg,
					args: argArray,
					newTarget: null,
					return: (r: any) => {
						returnValue = r;
					},
				};

				handler.apply(ctx);

				if (returnValue) {
					return returnValue;
				}

				return Reflect.apply(ctx.fn, ctx.this, ctx.args);
			};
		}

		target[prop] = new Proxy(value, h);
	}

	get url(): URL {
		return new URL(decodeUrl(location.href));
	}

	init() {
		console.log("SCRAMJET INIT");
	}
}

export const client = new ScramjetClient();
client.init();

// @ts-ignore
const context = import.meta.webpackContext("./", {
	recursive: true,
});

for (const key of context.keys()) {
	context(key);
}
