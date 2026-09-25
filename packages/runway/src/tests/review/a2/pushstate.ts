import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-pushstate-hrefs",
		js: `
			const a = document.createElement("a"); a.setAttribute("href", "#sec");
			const b = document.createElement("a"); b.setAttribute("href", "rel/x");
			const i = document.createElement("img"); i.setAttribute("src", "p.png");
			document.body.append(a, b, i);
			history.pushState({}, "", "/deep/path/page?q=1");
			assertConsistent("after push", [location.href.split("#")[0], document.baseURI.split("#")[0], a.href, b.href, i.src, document.URL.split("#")[0]].join(" | "));
			history.replaceState({}, "", "../other/");
			assertConsistent("after replace", [a.href, b.href, i.src, document.baseURI].join(" | "));
			location.hash = "h2";
			assertConsistent("after hash", [a.href, document.baseURI].join(" | "));
			const f = document.createElement("form"); document.body.appendChild(f);
			assertConsistent("form action", f.action);
			history.replaceState({}, "", "/");
		`,
	}),
];
