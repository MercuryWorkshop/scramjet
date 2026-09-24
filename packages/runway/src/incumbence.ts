/**
 * Harness for "which realm did the browser attribute this call to".
 *
 * A settings-object-sensitive API answers to one realm out of several that were
 * all involved in making the call, and which one depends on the API: `open`
 * parses its URL against the *entry* settings object, `postMessage` names the
 * *incumbent* one as the message's source, `fetch` uses the *current* one. The
 * realms only differ in how they are reached, so the same set of invocation
 * patterns exercises every one of those APIs, and the interesting artifact is
 * the column of answers each API produces over that shared set - see the tables
 * in `tests/incumbent*.ts`.
 *
 * Realms, and how the answer is read back:
 *
 *   top     the top document, `/`
 *   frame   the iframe at `/dir/frame.html`
 *   sub     the grandchild iframe at `/dir/sub/frame2.html`
 *   base    the frame document with `<base href="/base/">`, whose API base URL
 *           is no longer its own URL. The same *window* as `frame`, so only a
 *           URL-resolving sink can tell the two apart
 *   blank   an about:blank child of the frame, which inherits the frame's base
 *           URL and so reports as `frame`
 *
 * How the answer is read back depends on the sink. One that navigates asks for
 * `flag.html` and the page it lands on names the realm; one that fetches asks
 * for `probe.txt` and gets the name as the body; one with no URL at all - the
 * source of a `postMessage` - names the realm from a listener. All three end in
 * a call to `__report`, in the page, because the two harnesses share this
 * server and a server-side report could not say which browser made it.
 */

import { serverTest, type Test } from "./testcommon.ts";

export type Realm = "top" | "frame" | "sub" | "base";

/**
 * the flag a realm's API base URL resolves a bare `flag.html` to. A navigating
 * sink lands on one of these and the page reports which
 */
const REALM_OF_PATH: Record<string, Realm> = {
	"/flag.html": "top",
	"/dir/flag.html": "frame",
	"/dir/sub/flag.html": "sub",
	"/base/flag.html": "base",
};

/** the same, for a sink that fetches `probe.txt` instead of navigating */
const REALM_OF_PROBE: Record<string, Realm> = {
	"/probe.txt": "top",
	"/dir/probe.txt": "frame",
	"/dir/sub/probe.txt": "sub",
	"/base/probe.txt": "base",
};

/** the documents a pattern is built out of */
export type Docs = {
	/** inline script in the top document at `/` */
	top?: string;
	/** inline script in the frame document at `/dir/frame.html` */
	frame?: string;
	/**
	 * inline script in the grandchild at `/dir/sub/frame2.html`. When this is
	 * set - `""` included - the frame document embeds it
	 */
	sub?: string;
	/** `<base href>` for the top and frame documents */
	topbase?: string;
	framebase?: string;
	/**
	 * markup placed in the top and frame documents ahead of their inline
	 * script, so a `<script src>` here has run by the time that script does
	 */
	tophtml?: string;
	framehtml?: string;
	/** extra files served verbatim, keyed by path */
	files?: Record<string, string>;
};

/**
 * A way of getting a call to happen. `call(win)` yields the sink's own code,
 * performed through `win`'s realm, and the pattern decides which realm runs it
 * and how it gets there. `fn(win)` is the same operation as a function value
 * rather than a statement, for a pattern that has to hand the sink itself to
 * something else - see {@link Pattern.needsfn}.
 */
export type Pattern = {
	name: string;
	build: (call: (win: string) => string, fn: (win: string) => string) => Docs;
	/**
	 * The pattern builds out of `fn` and not `call`, so it only exists for a
	 * sink that can be expressed as a function - see `sinkfn` on
	 * {@link incumbenceMatrix}. An answer sheet naming one without it is an
	 * error rather than a skip: the row would otherwise be silently dropped
	 */
	needsfn?: boolean;
};

/** a JS string literal, safe to put inside an inline `<script>` */
const str = (s: string) => JSON.stringify(s).split("</").join("<\\/");

export const PATTERNS: Pattern[] = [
	{ name: "sanity", build: (c) => ({ frame: c("window") }) },
	{ name: "sanity-sanity", build: (c) => ({ top: c("window") }) },
	{ name: "crossrealm", build: (c) => ({ frame: c("parent") }) },
	{
		name: "functioncall",
		build: (c) => ({
			top: `function go(){ ${c("window")} }`,
			frame: "parent.go()",
		}),
	},
	{
		name: "eval",
		build: (c) => ({ frame: `parent.eval(${str(c("window"))})` }),
	},
	{
		name: "eval-functioncall",
		build: (c) => ({
			top: `function go(){ ${c("window")} }`,
			frame: "parent.eval('go()')",
		}),
	},
	{
		name: "functionctor",
		build: (c) => ({ frame: `new parent.Function(${str(c("window"))})()` }),
	},
	{
		name: "settimeout",
		build: (c) => ({ frame: `parent.setTimeout(${str(c("window"))})` }),
	},
	{
		name: "settimeout-cb",
		build: (c) => ({ frame: `parent.setTimeout(() => { ${c("parent")} })` }),
	},
	{
		name: "settimeout-cb-eval",
		build: (c) => ({
			frame: `parent.setTimeout(() => parent.eval(${str(c("window"))}))`,
		}),
	},
	{
		name: "promise",
		build: (c) => ({
			frame: `new Promise(r=>r()).then(new parent.Function(${str(c("window"))}))`,
		}),
	},
	{
		name: "promise-cb",
		build: (c) => ({
			frame: `new Promise(r=>r()).then(() => new parent.Function(${str(c("window"))})())`,
		}),
	},
	{
		name: "cross-promise",
		build: (c) => ({
			frame: `parent.eval('new Promise(r=>r())').then(() => new parent.Function(${str(c("window"))})())`,
		}),
	},
	{
		name: "cross-promise-direct",
		build: (c) => ({
			frame: `parent.eval('new Promise(r=>r())').then(new parent.Function(${str(c("window"))}))`,
		}),
	},
	{
		name: "event-listener",
		build: (c) => ({
			frame: `addEventListener('snarkle', () => { ${c("parent")} })`,
			top: "onload = () => frames[0].dispatchEvent(new Event('snarkle'))",
		}),
	},

	// where the base URL comes from. A script does not have one; the document
	// it runs in does, and `<base>` moves that out from under the document's
	// own URL. `/other/` is where an implementation lands if it takes the base
	// off the script, and no table expects it
	{
		name: "external-script",
		build: (c) => ({
			files: { "/other/script.js": c("window") },
			framehtml: `<script src="/other/script.js"></script>`,
		}),
	},
	{
		name: "external-script-crossrealm",
		build: (c) => ({
			files: { "/other/script.js": `function go(){ ${c("window")} }` },
			tophtml: `<script src="/other/script.js"></script>`,
			frame: "parent.go()",
		}),
	},
	{
		name: "module",
		build: (c) => ({
			framehtml: `<script type="module">${c("window")}</script>`,
		}),
	},
	{
		name: "module-external",
		build: (c) => ({
			files: { "/other/module.js": c("window") },
			framehtml: `<script type="module" src="/other/module.js"></script>`,
		}),
	},
	{
		name: "base-element",
		build: (c) => ({ framebase: "/base/", frame: c("window") }),
	},
	{
		name: "base-element-crossrealm",
		build: (c) => ({ topbase: "/base/", frame: c("parent") }),
	},

	// direction and depth. Everything above calls from the frame into the top,
	// and the machinery is not symmetric. With three realms the entry realm,
	// the incumbent realm and the callee's realm are three different answers
	{
		name: "reverse-crossrealm",
		build: (c) => ({ top: `onload = () => { ${c("frames[0]")} }` }),
	},
	{
		name: "reverse-functioncall",
		build: (c) => ({
			frame: `function go(){ ${c("window")} }`,
			top: "onload = () => frames[0].go()",
		}),
	},
	{ name: "three-realm-sanity", build: (c) => ({ sub: c("window") }) },
	{
		name: "three-realm",
		build: (c) => ({
			sub: `function go(){ ${c("window")} }`,
			frame: "function callSub(){ frames[0].go() }",
			top: "onload = () => frames[0].callSub()",
		}),
	},
	{
		// the callback is the top's function, converted in the frame, and
		// dispatched by the sub's timer - three realms, one per role
		name: "three-realm-timer",
		build: (c) => ({
			sub: "",
			top: `function go(){ ${c("window")} }`,
			frame: "onload = () => frames[0].setTimeout(parent.go)",
		}),
	},

	// which realm a callback belongs to. Invoking one enters its *own* realm,
	// so a foreign function passed as a callback answers with the realm that
	// defined it and not the realm that converted, registered or dispatched it
	{
		name: "settimeout-foreign-cb",
		build: (c) => ({
			top: `function go(){ ${c("window")} }`,
			frame: "parent.setTimeout(parent.go)",
		}),
	},
	{
		name: "event-listener-foreign-cb",
		build: (c) => ({
			top:
				`function go(){ ${c("window")} }` +
				"onload = () => frames[0].dispatchEvent(new Event('snarkle'))",
			frame: "addEventListener('snarkle', parent.go)",
		}),
	},
	{
		name: "event-listener-foreign-target",
		build: (c) => ({
			top:
				`function go(){ ${c("window")} }` +
				"onload = () => { frames[0].addEventListener('snarkle', go); frames[0].dispatchEvent(new Event('snarkle')) }",
		}),
	},
	{
		// binding does not launder the realm
		name: "promise-bound",
		build: (c) => ({
			top: `function go(){ ${c("window")} }`,
			frame: "new Promise(r=>r()).then(parent.go.bind(null))",
		}),
	},

	// host boundaries that run with nothing else on the stack. The
	// event-listener patterns dispatch synchronously, so the top is on the
	// stack under the listener; these are not
	{
		name: "message-event",
		build: (c) => ({
			top: "onload = () => frames[0].postMessage('go', '*')",
			frame: `addEventListener('message', () => { ${c("parent")} })`,
		}),
	},
	{
		name: "queuemicrotask",
		build: (c) => ({
			frame: `parent.queueMicrotask(() => { ${c("parent")} })`,
		}),
	},
	{
		name: "async-await",
		build: (c) => ({
			frame: `(async () => { await parent.eval('Promise.resolve()'); ${c("parent")} })()`,
		}),
	},
	{
		// `functioncall` with one `await` added to the top's function, which
		// moves the call out of the frame's turn and into a job of the top's
		name: "async-crossrealm-function",
		build: (c) => ({
			top: `async function go(){ await Promise.resolve(); ${c("window")} }`,
			frame: "parent.go()",
		}),
	},
	{
		// a content attribute is compiled by the parser against the element's
		// document, however it is later triggered
		name: "inline-handler",
		build: (c) => ({
			framehtml: `<button id="b" onclick="${c("window")}"></button>`,
			top: "onload = () => frames[0].document.getElementById('b').click()",
		}),
	},

	// unusual script-having contexts
	{
		name: "direct-eval-crossrealm",
		build: (c) => ({
			top: "function doEval(s){ return eval(s) }",
			frame: `parent.doEval(${str(c("window"))})`,
		}),
	},
	{
		name: "builtin-callback",
		build: (c) => ({
			top: `function go(){ ${c("window")} }`,
			frame: "[0].map(parent.go)",
		}),
	},
	{
		// the call happens inside argument coercion, while the top's
		// `setTimeout` is converting its arguments and before it has done
		// anything
		name: "argument-coercion",
		build: (c) => ({
			frame: `parent.setTimeout(() => {}, parent.eval(${str(
				`({ valueOf() { ${c("window")}; return 0 } })`
			)}))`,
		}),
	},
	{
		name: "dynamic-import",
		build: (c) => ({
			files: { "/other/module.js": c("window") },
			frame: `parent.eval("import('/other/module.js')")`,
		}),
	},

	// realms with no URL of their own, which inherit a base URL from the
	// document that created them
	{
		name: "about-blank",
		build: (c) => ({
			frame: `onload = () => {
				const f = document.createElement('iframe');
				document.documentElement.appendChild(f);
				f.contentDocument.write(${str(`<script>${c("window")}</script>`)});
			}`,
		}),
	},
	{
		name: "srcdoc",
		build: (c) => ({
			frame: `onload = () => {
				const f = document.createElement('iframe');
				f.srcdoc = ${str(`<script>${c("window")}</script>`)};
				document.documentElement.appendChild(f);
			}`,
		}),
	},

	// the backup incumbent settings object. Every pattern above reaches the sink
	// with page script on the JS execution context stack, and the incumbent is
	// read off the topmost script-having context there. A callback that is not
	// script-having - a bound function whose target is native - puts nothing on
	// that stack, and the incumbent comes off the *backup incumbent settings
	// object stack* instead: "prepare to run a callback" pushes the callback's
	// context, the realm that was incumbent when the callback was **converted**,
	// and the topmost entry of that stack answers whenever it was pushed more
	// recently than the topmost script-having context. So it is what an empty
	// stack falls back to, and it also outranks a script that is still on the
	// stack under a synchronous dispatch. Not the realm that owns the API, not
	// the realm that owns the function, not the realm that made the bound object
	//
	// These take `fn` instead of `call`, because the sink has to *be* the
	// function the host invokes: anything wrapped around it is a script on the
	// stack again, and that wrapped shape is the pattern each one pairs with
	{
		// the control. Binding launders nothing, so while script is on the stack
		// the answer is the caller and the backup stack is never reached
		name: "backup-control-direct",
		needsfn: true,
		build: (_c, fn) => ({ frame: `(${fn("parent")})()` }),
	},
	{
		// pairs with `settimeout-cb`, which wraps the same call in an arrow
		// function of the frame's
		name: "backup-settimeout",
		needsfn: true,
		build: (_c, fn) => ({ frame: `parent.setTimeout(${fn("parent")})` }),
	},
	{
		name: "backup-queuemicrotask",
		needsfn: true,
		build: (_c, fn) => ({ frame: `parent.queueMicrotask(${fn("parent")})` }),
	},
	{
		// pairs with `promise-bound`: the same bound-function shape, where the
		// bound target is script-having there and native here
		name: "backup-promise",
		needsfn: true,
		build: (_c, fn) => ({ frame: `new Promise(r=>r()).then(${fn("parent")})` }),
	},
	{
		name: "backup-message-event",
		needsfn: true,
		build: (_c, fn) => ({
			top: "onload = () => frames[0].postMessage('go', '*')",
			frame: `addEventListener('message', ${fn("parent")})`,
		}),
	},
	{
		// the dispatch is synchronous, so the top's script is still on the stack
		// under the listener - and loses anyway, because the entry the dispatch
		// pushed for the listener is the more recent of the two. Pairs with
		// `event-listener-foreign-cb`, the same dispatch into a callback that
		// *is* script-having, where the callback's own context is pushed above
		// the backup entry and the top answers
		name: "backup-sync-dispatch",
		needsfn: true,
		build: (_c, fn) => ({
			frame: `addEventListener('snarkle', ${fn("parent")})`,
			top: "onload = () => frames[0].dispatchEvent(new Event('snarkle'))",
		}),
	},
	{
		// the bound object is made in the top and converted in the frame, so the
		// realm that built the callback and the realm that handed it over are
		// different ones. Pairs with `settimeout-foreign-cb`, where the same
		// split answers with the top because the callback has a script in it
		name: "backup-foreign-bound",
		needsfn: true,
		build: (_c, fn) => ({
			top: `var bound = ${fn("window")}`,
			frame: "parent.setTimeout(parent.bound)",
		}),
	},
	{
		// the sub converts the callback and the top owns the timer, so the
		// answer is a realm on neither end of the call
		name: "backup-three-realm",
		needsfn: true,
		build: (_c, fn) => ({
			sub: `parent.parent.setTimeout(${fn("parent.parent")})`,
		}),
	},
];

/** one test: serve `docs`, expect the first report to name `expect` */
export function incumbenceTest(props: {
	name: string;
	docs: Docs;
	expect: Realm;
}): Test {
	const docs = props.docs;
	const want = JSON.stringify(props.expect);
	const base = (href?: string) => (href ? `<base href="${href}">` : "");
	// an inline script may not contain `</script`, and a sink embedded in a
	// string literal legitimately can
	const script = (js?: string) =>
		`<script>${(js ?? "").split("</script").join("<\\/script")}</script>`;

	// Reporting happens in the page and not from this server, because the two
	// harnesses share one server and one pass/fail pair - a server-side report
	// cannot say which browser made the request, and whichever one got there
	// first would answer for both. `pass` and `fail` are the harness's own
	// bindings, installed per page in every document
	//
	// `__top` is the top document *of this test*, which is not `window.top`:
	// the bare harness loads the site in an iframe of its own page, so `top` is
	// the harness and cross-origin. Walking up while the parent is still one of
	// these documents stops in the right place under either harness
	const prelude = `window.__isSite = true;
	window.__top = (function () {
		var w = window;
		try { while (w.parent !== w && w.parent.__isSite) w = w.parent } catch (e) {}
		return w;
	})();
	function __report(realm) {
		if (window.__reported) return;
		window.__reported = true;
		if (realm === ${want}) pass('attributed to ' + realm);
		else fail('attributed to ' + realm + ', wanted ' + ${want});
	}`;

	// a flag page is reached by navigating, so it reports through the first
	// instrumented window it can see - its opener when a sink opened it, its
	// embedder when a sink navigated a frame. The comparison is inlined rather
	// than deferred to `__report` because that window may be an about:blank
	// realm, which the harness instruments but this server never served
	const flagPage = (realm: Realm) => `
		var t = [];
		try { if (opener) t.push(opener) } catch (e) {}
		try { if (parent !== window) t.push(parent) } catch (e) {}
		try { if (top !== window) t.push(top) } catch (e) {}
		t.push(window);
		for (var i = 0; i < t.length; i++) {
			try {
				if (typeof t[i].fail !== 'function') continue;
				${
					realm === props.expect
						? `t[i].pass('attributed to ${realm}')`
						: `t[i].fail('attributed to ${realm}, wanted ${props.expect}')`
				};
				break;
			} catch (e) {}
		}`;

	return serverTest({
		name: props.name,
		async start(server) {
			server.on("request", (req, res) => {
				const url = req.url!;
				const html = (body: string) => {
					res.setHeader("Content-Type", "text/html");
					res.end(`<!doctype html>${body}`);
				};

				if (url === "/") {
					html(
						base(docs.topbase) +
							(docs.tophtml ?? "") +
							script(prelude + ";" + (docs.top ?? "")) +
							`<iframe src="/dir/frame.html">`
					);
				} else if (url === "/dir/frame.html") {
					html(
						base(docs.framebase) +
							(docs.framehtml ?? "") +
							script(prelude + ";" + (docs.frame ?? "")) +
							(docs.sub !== undefined
								? `<iframe src="/dir/sub/frame2.html">`
								: "")
					);
				} else if (url === "/dir/sub/frame2.html") {
					html(script(prelude + ";" + (docs.sub ?? "")));
				} else if (docs.files && url in docs.files) {
					res.setHeader(
						"Content-Type",
						url.endsWith(".js") ? "text/javascript" : "text/html"
					);
					res.end(docs.files[url]);
				} else if (url in REALM_OF_PATH) {
					html(script(flagPage(REALM_OF_PATH[url])));
				} else if (url in REALM_OF_PROBE) {
					// for a sink that fetches rather than navigates: the body is
					// the answer, and the caller reports it
					res.setHeader("Content-Type", "text/plain");
					res.end(REALM_OF_PROBE[url]);
				} else {
					res.statusCode = 404;
					console.error("Not Found: " + url);
					res.end();
				}
			});
		},
	});
}

/**
 * One test per pattern, for a single API.
 *
 * `expect` is the answer sheet: the realm the browser attributes the call to,
 * per pattern. A pattern with no entry is skipped, which is how a sink opts out
 * of one it cannot express.
 */
export function incumbenceMatrix(props: {
	/** test name prefix, e.g. `incumbent-window-open` */
	prefix: string;
	/**
	 * the operation, as a statement performed through `win`'s realm. It ends up
	 * inside string literals and HTML attributes, so it must use single quotes
	 * and no `"`
	 */
	sink: (win: string) => string;
	/**
	 * The same operation as an expression evaluating to a function that performs
	 * it when called with no arguments, for the patterns that need the host to
	 * call the sink directly. It has to be a *native* function - bound, not
	 * wrapped - or the script wrapping it is what the browser attributes the
	 * call to. Without it, the `needsfn` patterns are unavailable
	 */
	sinkfn?: (win: string) => string;
	/** script prepended to a document, for a sink that needs a receiver */
	setup?: Docs;
	expect: Partial<Record<string, Realm>>;
	patterns?: Pattern[];
}): Test[] {
	const patterns = props.patterns ?? PATTERNS;
	const tests: Test[] = [];

	for (const pattern of patterns) {
		const expect = props.expect[pattern.name];
		if (!expect) continue;

		if (pattern.needsfn && !props.sinkfn) {
			throw new Error(
				`${props.prefix}: pattern ${pattern.name} needs a \`sinkfn\`, which this sink does not have`
			);
		}

		const docs = pattern.build(props.sink, props.sinkfn ?? props.sink);
		const setup = props.setup;
		if (setup) {
			for (const realm of ["top", "frame", "sub"] as const) {
				if (setup[realm] === undefined) continue;
				// the setup runs in the same realm as the pattern's own script,
				// so prepending it changes nothing about how that script is
				// reached
				docs[realm] = `${setup[realm]};\n${docs[realm] ?? ""}`;
			}
			if (setup.files) docs.files = { ...setup.files, ...docs.files };
		}

		tests.push(
			incumbenceTest({ name: `${props.prefix}-${pattern.name}`, docs, expect })
		);
	}

	const missing = Object.keys(props.expect).filter(
		(name) => !patterns.some((p) => p.name === name)
	);
	if (missing.length) {
		throw new Error(
			`${props.prefix}: no such pattern: ${missing.join(", ")}. Answer sheets name patterns, and a typo would silently drop a test`
		);
	}

	return tests;
}
