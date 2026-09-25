import { htmlTest } from "../../../testcommon.ts";

// HTMLHyperlinkElementUtils on a/area: every getter and setter over odd href
// values, read back through getAttribute and the reflected href.

const HREFS = [
	"/p/q?x=1#h",
	"",
	"#frag",
	"?q",
	"javascript:void(0)",
	"mailto:a@b.c",
	"http://[bad",
	"https://u:p@ex.test:8443/a/b?c#d",
	"data:text/plain,hi",
	"blob:https://ex.test/uuid",
	"about:blank",
	"//ex.test/x",
	"tel:+1",
	"file:///x",
	"HTTP://EX.TEST",
	null,
];
const PARTS = [
	"href",
	"origin",
	"protocol",
	"username",
	"password",
	"host",
	"hostname",
	"port",
	"pathname",
	"search",
	"hash",
];
const SETS: [string, string][] = [
	["protocol", "https"],
	["protocol", "ftp:"],
	["username", "me"],
	["password", "pw"],
	["host", "x.test:81"],
	["hostname", "y.test"],
	["port", "8080"],
	["port", ""],
	["pathname", "/np"],
	["pathname", "np"],
	["search", "q=2"],
	["search", ""],
	["hash", "nh"],
	["hash", ""],
];

export default [
	htmlTest({
		name: "rv13-urlparts",
		html: `<!doctype html><body><map name=m></map><script>
const T = (f) => { try { const v = f(); return v === undefined ? "u" : v === null ? "N" : String(v); } catch (e) { return "THROW:" + e.name; } };
runTest(async () => {
	const HREFS = ${JSON.stringify(HREFS)}, PARTS = ${JSON.stringify(PARTS)}, SETS = ${JSON.stringify(SETS)};
	for (const tag of ["a", "area"]) {
		HREFS.forEach((h, i) => {
			const mk = () => { const e = document.createElement(tag); if (h !== null) e.setAttribute("href", h); document.querySelector(tag === "area" ? "map" : "body").append(e); return e; };
			const e = mk();
			assertConsistent(tag + " get " + i, PARTS.map((p) => p + "=" + T(() => e[p])).join(" ;; "));
			for (const [p, v] of SETS) {
				const s = mk();
				let r;
				try { s[p] = v; r = "attr=" + T(() => s.getAttribute("href")) + " ;; href=" + T(() => s.href) + " ;; " + p + "=" + T(() => s[p]); } catch (err) { r = "THROW " + err.name; }
				assertConsistent(tag + " set " + i + " " + p + "=" + v, r);
			}
		});
	}
}, true);
</script></body>`,
	}),
];
