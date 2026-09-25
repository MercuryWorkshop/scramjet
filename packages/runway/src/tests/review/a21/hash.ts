import { basicTest, type Test } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv21-hash-frames",
		js: `
		const R = {};
		const norm = (s) => String(s).replace(location.origin, "SELF").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, "UUID");
		const code = \`addEventListener("hashchange", (e) => parent.postMessage({ hc: KIND, o: e.oldURL, n: e.newURL, href: location.href, hash: location.hash }, "*")); location.hash = "rv21";\`;
		const got = {};
		addEventListener("message", (e) => { if (e.data && e.data.hc) got[e.data.hc] = [norm(e.data.o), norm(e.data.n), norm(e.data.href), e.data.hash].join(" ; "); });
		const f1 = document.createElement("iframe"); document.body.appendChild(f1); f1.contentWindow.eval("var KIND='blank';" + code);
		const f2 = document.createElement("iframe"); f2.srcdoc = "<script>var KIND='srcdoc';" + code + "<\\/script>"; document.body.appendChild(f2);
		const b = URL.createObjectURL(new Blob(["<script>var KIND='blob';" + code + "<\\/script>"], { type: "text/html" }));
		const f3 = document.createElement("iframe"); f3.src = b; document.body.appendChild(f3);
		const f4 = document.createElement("iframe"); f4.src = "/x?q=1"; document.body.appendChild(f4);
		await new Promise((r) => f4.onload = r);
		f4.contentWindow.eval("var KIND='real';" + code);
		await new Promise((r) => setTimeout(r, 1500));
		for (const k of Object.keys(got)) R[k] = got[k];
		R.seen = Object.keys(got).sort().join(",");
		console.log("RV21", JSON.stringify(R));
		for (const k of Object.keys(R).sort()) assertConsistent(k, R[k]);
	`,
	}),
] as Test[];
