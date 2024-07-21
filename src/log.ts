const _dbg = {
	fmt: function (severity: string, message: string, ...args: any[]) {
		const old = Error.prepareStackTrace;

		Error.prepareStackTrace = (_, stack) => {
			stack.shift(); // stack();
			stack.shift(); // fmt();

			for (let i = 0; i < stack.length; i++) {
				if (Object.values(this).includes(stack[i].getFunction())) {
					stack.splice(i, 1);
				}
			}

			let frame = stack[0];
			while (!frame?.getFunctionName() || !frame) {
				frame = stack.shift();
			}

			const fn = stack[0].getFunctionName();

			return `${fn}()`;
		};

		const fmt = (function stack() {
			try {
				throw new Error();
			} catch (e) {
				return e.stack;
			}
		})();

		Error.prepareStackTrace = old;

		const fn = console[severity] || console.log;
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
			`%c${fmt}%c ${message}`,
			`
background-color: ${bg};
color: ${fg};
padding: ${padding}px;
font-weight: bold;
`,
			`
${severity === "debug" ? "color: gray" : ""}
`,
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
};

for (const key in _dbg) {
	_dbg[key] = (0, eval)("(" + _dbg[key].toString() + ")");
}
self._dbg = _dbg;

export default _dbg;
