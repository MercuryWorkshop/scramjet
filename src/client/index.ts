import { decodeUrl } from "./shared";

declare global {
	interface Window {
		$s: any;
		$tryset: any;
		$sImport: any;
	}
}
type AnyFunction = (...args: any[]) => any;

type ProxyCtx = {
	fn: AnyFunction;
	this: any;
	args: any[];
	newTarget: AnyFunction;
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
		if (!target) return;
		if (!Reflect.has(target, prop)) return;

		const value = Reflect.get(target, prop);
		delete target[prop];

		const h: ProxyHandler<any> = {};

		if (handler.construct) {
			h.construct = function (
				target: any,
				argArray: any[],
				newTarget: AnyFunction
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

	async init() {
		function b64(buffer) {
			let binary = "";
			let bytes = new Uint8Array(buffer);
			let len = bytes.byteLength;
			for (let i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}

			return window.btoa(binary);
		}
		const arraybuffer = await (await fetch("/scramjet.png")).arrayBuffer();
		console.log(
			"%cb",
			`
background-image: url(data:image/png;base64,${b64(arraybuffer)});
color: transparent;
padding-left: 200px;
padding-bottom: 100px;
background-size: contain;
background-position: center center;
background-repeat: no-repeat;
`
		);
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
