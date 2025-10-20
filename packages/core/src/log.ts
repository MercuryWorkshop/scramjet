// import { flagEnabled } from "@/shared";
import type { URLMeta } from "@rewriters/url";

const logfuncs = {
	log: console.log,
	warn: console.warn,
	error: console.error,
	debug: console.debug,
	info: console.info,
};

export default {
	fmt: function (severity: string, message: string, ...args: any[]) {
		const old = Error.prepareStackTrace;

		Error.prepareStackTrace = (_, stack) => {
			stack.shift(); // stack();
			stack.shift(); // fmt();
			stack.shift();

			let fmt = "";
			for (let i = 1; i < Math.min(2, stack.length); i++) {
				if (stack[i].getFunctionName()) {
					// const f = stack[i].getThis()?.constructor?.name;
					// if (f) fmt += `${f}.`
					fmt += `${stack[i].getFunctionName()} -> ` + fmt;
				}
			}
			fmt += stack[0].getFunctionName() || "Anonymous";

			return fmt;
		};

		const fmt = (function stack() {
			try {
				throw new Error();
			} catch (e) {
				return e.stack;
			}
		})();

		Error.prepareStackTrace = old;

		this.print(severity, fmt, message, ...args);
	},
	print(severity: string, tag: string, message: string, ...args: any[]) {
		const fn = logfuncs[severity] || logfuncs.log;
		const bg = {
			log: "#000",
			warn: "#f80",
			error: "#f00",
			debug: "transparent",
		}[severity];
		const fg = {
			log: "#fff",
			warn: "#fff",
			error: "#fff",
			debug: "gray",
		}[severity];
		const padding = {
			log: 2,
			warn: 4,
			error: 4,
			debug: 0,
		}[severity];

		fn(
			`%c${tag}%c ${message}`,
			`
  	background-color: ${bg};
  	color: ${fg};
  	padding: ${padding}px;
  	font-weight: bold;
  	font-family: monospace;
  	font-size: 0.9em;
  `,
			`${severity === "debug" ? "color: gray" : ""}`,
			...args
		);
	},
	log: function (message: string, ...args: any[]) {
		this.fmt("log", message, ...args);
	},
	warn: function (message: string, ...args: any[]) {
		this.fmt("warn", message, ...args);
	},
	error: function (message: string, ...args: any[]) {
		this.fmt("error", message, ...args);
	},
	debug: function (message: string, ...args: any[]) {
		this.fmt("debug", message, ...args);
	},
	time(meta: URLMeta, before: number, type: string) {
		if (1) return;
		const after = performance.now();
		const duration = after - before;

		let timespan: string;
		if (duration < 1) {
			timespan = "BLAZINGLY FAST";
		} else if (duration < 500) {
			timespan = "decent speed";
		} else {
			timespan = "really slow";
		}
		this.print(
			"debug",
			"[time]",
			`${type} was ${timespan} (${duration.toFixed(2)}ms)`
		);
	},
};
