import { serverTest } from "../testcommon.ts";

const doc = (text: string) => `<!doctype html>${text}`;

function navIncumbenceTest(props: {
	name: string;
	js: string;
	reverse?: boolean;
	topjs?: string;
}) {
	props.topjs ??= "";
	props.reverse ??= false;
	return serverTest({
		name: props.name,
		async start(server, port, { pass, fail }) {
			server.on("request", (req, res) => {
				if (req.url! === "/") {
					res.setHeader("Content-Type", "text/html");
					res.end(
						doc(`<script>${props.topjs}</script><iframe src="/dir/frame.html">`)
					);
				} else if (req.url! === "/dir/frame.html") {
					res.setHeader("Content-Type", "text/html");
					res.end(doc(`<script>${props.js}</script>`));
				} else if (req.url! === "/dir/flag.html") {
					res.setHeader("Content-Type", "text/html");
					if (props.reverse) {
						res.end(doc(`<script>opener.fail("wrong window opened")</script>`));
					} else {
						res.end(
							doc(`<script>opener.pass("correct window opened")</script>`)
						);
					}
				} else if (req.url! === "/flag.html") {
					res.setHeader("Content-Type", "text/html");
					if (props.reverse) {
						res.end(
							doc(`<script>opener.pass("correct window opened")</script>`)
						);
					} else {
						res.end(doc(`<script>opener.fail("wrong window opened")</script>`));
					}
				} else {
					res.statusCode = 404;
					console.error("Not Found: " + req.url);
					res.end();
				}
			});
		},
	});
}

export default [
	navIncumbenceTest({
		name: "incumbent-window-open-sanity",
		js: "window.open('flag.html')",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-sanity-sanity",
		topjs: "window.open('flag.html')",
		js: "",
		reverse: true,
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-crossrealm",
		js: "parent.window.open('flag.html')",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-functioncall",
		topjs: `function doOpen(){ window.open('flag.html') }`,
		js: "parent.doOpen()",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-eval",
		js: "parent.eval('window.open(`flag.html`)')",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-eval-functioncall",
		topjs: `function doOpen(){ window.open('flag.html') }`,
		js: "parent.eval('doOpen()')",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-functionctor",
		js: "new parent.Function('window.open(`flag.html`)')()",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-settimeout",
		reverse: true,
		js: "parent.setTimeout('window.open(`flag.html`)')",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-settimeout-cb",
		js: "parent.setTimeout(()=>parent.window.open(`flag.html`))",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-settimeout-cb-eval",
		js: "parent.setTimeout(()=>parent.eval('window.open(`flag.html`)'))",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-promise",
		js: "new Promise(r=>r()).then(new parent.Function('window.open(`flag.html`)'))",
		reverse: true,
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-promise-cb",
		js: "new Promise(r=>r()).then(()=>new parent.Function('window.open(`flag.html`)')())",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-cross-promise",
		js: "parent.eval('new Promise(r=>r())').then(()=>new parent.Function('window.open(`flag.html`)')())",
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-cross-promise-direct",
		js: "parent.eval('new Promise(r=>r())').then(new parent.Function('window.open(`flag.html`)'))",
		reverse: true,
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-cross-promise-direct",
		js: "parent.eval('new Promise(r=>r())').then(new parent.Function('window.open(`flag.html`)'))",
		reverse: true,
	}),
	navIncumbenceTest({
		name: "incumbent-window-open-event-listener",
		js: "addEventListener('snarkle', ()=>{ parent.window.open('flag.html') })",
		topjs:
			"window.onload = () => { frames[0].dispatchEvent(new Event('snarkle')) }",
	}),
];
