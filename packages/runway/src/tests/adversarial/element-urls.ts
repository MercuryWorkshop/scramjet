import { basicTest } from "../../testcommon.ts";

// URL-bearing element properties are reflected: the attribute keeps the page's
// literal value while the IDL property resolves against the *real* document
// URL. Anything that leaks the proxy URL here shows up in analytics payloads,
// CORS checks, cache keys and `new URL(el.href)` comparisons.

export default [
	basicTest({
		name: "elurls-img-src",
		js: `
			const img = document.createElement("img");
			img.src = "/pic.png";
			assertEqual(img.src, location.origin + "/pic.png", "img.src resolves against the real origin");
			assertEqual(img.getAttribute("src"), "/pic.png", "getAttribute returns the literal value");
			assertEqual(img.outerHTML, '<img src="/pic.png">', "outerHTML");
			img.setAttribute("src", "/other.png");
			assertEqual(img.src, location.origin + "/other.png", "setAttribute then read the property");
			assert(!img.src.includes("/~/sj/"), "no proxy URL in img.src");
			img.src = "https://example.com/abs.png";
			assertEqual(img.src, "https://example.com/abs.png", "absolute cross-origin src");
			assertEqual(img.getAttribute("src"), "https://example.com/abs.png", "absolute src attribute");
		`,
	}),
	basicTest({
		name: "elurls-anchor-components",
		js: `
			const a = document.createElement("a");
			a.href = "/p/q?x=1#f";
			assertEqual(a.href, location.origin + "/p/q?x=1#f", "href");
			assertEqual(a.protocol, "http:", "protocol");
			assertEqual(a.host, location.host, "host");
			assertEqual(a.hostname, "localhost", "hostname");
			assertEqual(a.port, location.port, "port");
			assertEqual(a.pathname, "/p/q", "pathname");
			assertEqual(a.search, "?x=1", "search");
			assertEqual(a.hash, "#f", "hash");
			assertEqual(a.origin, location.origin, "origin");
			assertEqual(a.getAttribute("href"), "/p/q?x=1#f", "the attribute keeps the literal value");
			a.hash = "#g";
			assertEqual(a.href, location.origin + "/p/q?x=1#g", "setting hash");
			a.protocol = "http:";
			assertEqual(a.href, location.origin + "/p/q?x=1#g", "setting protocol");
		`,
	}),
	basicTest({
		name: "elurls-other-elements",
		js: `
			const f = document.createElement("form");
			f.action = "/submit";
			assertEqual(f.action, location.origin + "/submit", "form.action");
			assertEqual(f.getAttribute("action"), "/submit", "action attribute");
			const s = document.createElement("script");
			s.src = "/s.js";
			assertEqual(s.src, location.origin + "/s.js", "script.src");
			const l = document.createElement("link");
			l.href = "/style.css";
			assertEqual(l.href, location.origin + "/style.css", "link.href");
			const ifr = document.createElement("iframe");
			ifr.src = "/frame.html";
			assertEqual(ifr.src, location.origin + "/frame.html", "iframe.src");
			const frame = document.createElement("frame");
			frame.src = "/frame2.html";
			assertEqual(frame.src, location.origin + "/frame2.html", "frame.src");
			const src = document.createElement("source");
			src.src = "/clip.mp4";
			assertEqual(src.src, location.origin + "/clip.mp4", "source.src");
			const audio = document.createElement("audio");
			audio.src = "/a.mp3";
			assertEqual(audio.src, location.origin + "/a.mp3", "audio.src");
			const embed = document.createElement("embed");
			embed.src = "/e.swf";
			assertEqual(embed.src, location.origin + "/e.swf", "embed.src");
			const obj = document.createElement("object");
			obj.data = "/o.bin";
			assertEqual(obj.data, location.origin + "/o.bin", "object.data");
		`,
	}),
	basicTest({
		name: "elurls-srcset",
		js: `
			const img = document.createElement("img");
			img.srcset = "/a.png 1x, /b.png 2x";
			assertEqual(img.srcset, "/a.png 1x, /b.png 2x", "srcset round trip");
			assertEqual(img.getAttribute("srcset"), "/a.png 1x, /b.png 2x", "srcset attribute");
			assert(!img.srcset.includes("/~/sj/"), "no proxy URL in srcset");
		`,
	}),
	basicTest({
		name: "elurls-parsed-from-html",
		js: `
			const d = document.createElement("div");
			d.innerHTML = '<a href="/x">l</a><img src="/y.png"><form action="/z"></form>';
			assertEqual(d.innerHTML, '<a href="/x">l</a><img src="/y.png"><form action="/z"></form>', "innerHTML round trip");
			assertEqual(d.querySelector("a").href, location.origin + "/x", "parsed anchor href");
			assertEqual(d.querySelector("img").getAttribute("src"), "/y.png", "parsed img attribute");
			assertEqual(d.querySelector("form").action, location.origin + "/z", "parsed form action");
		`,
	}),
	basicTest({
		name: "elurls-relative-forms",
		js: `
			const a = document.createElement("a");
			for (const [input, expected] of [
				["", location.origin + location.pathname + location.search],
				["#frag", location.origin + "/#frag"],
				["?q=1", location.origin + "/?q=1"],
				["./rel", location.origin + "/rel"],
				["//localhost:" + location.port + "/pp", location.origin + "/pp"],
			]) {
				a.href = input;
				assertEqual(a.href, expected, "resolving " + JSON.stringify(input));
			}
		`,
	}),
	basicTest({
		name: "elurls-request-response",
		js: `
			assertEqual(new Request("/api").url, location.origin + "/api", "Request.url");
			assertEqual(new Request(location.origin + "/api").url, location.origin + "/api", "absolute Request.url");
			const r = await fetch("/script.js");
			assertEqual(r.url, location.origin + "/script.js", "Response.url");
			assertEqual(r.status, 200, "status");
			assertEqual(r.redirected, false, "redirected");
			assert(!r.url.includes("/~/sj/"), "no proxy URL in Response.url");
		`,
	}),
	basicTest({
		name: "elurls-xhr-response-url",
		js: `
			const xhr = new XMLHttpRequest();
			await new Promise((res, rej) => {
				xhr.onload = res;
				xhr.onerror = rej;
				xhr.open("GET", "/script.js");
				xhr.send();
			});
			assertEqual(xhr.responseURL, location.origin + "/script.js", "xhr.responseURL");
			assertEqual(xhr.status, 200, "status");
		`,
	}),
	basicTest({
		name: "elurls-websocket-url",
		js: `
			const ws = new WebSocket("ws://localhost:1/nope");
			assertEqual(ws.url, "ws://localhost:1/nope", "WebSocket.url");
			try { ws.close(); } catch {}
		`,
	}),

	// ------------------------------------------------------------------
	basicTest({
		// KNOWN FAILURE: HTMLAnchorElement's stringifier is not proxied, so
		// `String(a)` / `a + ""` / `a.toString()` return the proxy URL even
		// though `a.href` is correct. Anchor stringification is common in
		// analytics and link-interception code.
		name: "elurls-anchor-stringifier",
		js: `
			const a = document.createElement("a");
			a.href = "/p/q?x=1#f";
			assertEqual(a.toString(), a.href, "toString");
			assertEqual(String(a), a.href, "String()");
			assertEqual(a + "", a.href, "concatenation");
			assertEqual(\`\${a}\`, a.href, "template literal");
			assertEqual(new URL(a).href, a.href, "usable as a URL argument");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: these reflected URL properties are not proxied at all,
		// so they resolve the page's relative URL against the *proxy* document
		// URL. video.poster hands back the whole /~/sj/… URL; the rest come back
		// on the proxy origin. formAction in particular decides where a real
		// form submits.
		name: "elurls-unproxied-properties",
		js: `
			const cases = [
				["video", "poster", "/poster.jpg"],
				["track", "src", "/captions.vtt"],
				["input", "src", "/button.png"],
				["area", "href", "/region"],
				["base", "href", "/basedir/"],
				["button", "formAction", "/submit"],
				["input", "formAction", "/submit"],
			];
			for (const [tag, prop, value] of cases) {
				const e = document.createElement(tag);
				e[prop] = value;
				assertEqual(e[prop], location.origin + value, tag + "." + prop);
			}
		`,
	}),
	basicTest({
		// KNOWN FAILURE: writing a URL *component* of an anchor goes through the
		// unproxied setter. `search` is swallowed entirely and `pathname`/`host`
		// rewrite href into the raw proxy URL. Stripping tracking parameters with
		// `a.search = …` is a common pattern.
		name: "elurls-anchor-component-setters",
		js: `
			const mk = () => { const a = document.createElement("a"); a.href = "/p/q?x=1#f"; return a; };
			let a = mk();
			a.search = "?y=2";
			assertEqual(a.href, location.origin + "/p/q?y=2#f", "setting search");
			a = mk();
			a.pathname = "/changed";
			assertEqual(a.href, location.origin + "/changed?x=1#f", "setting pathname");
			a = mk();
			a.host = "example.com:" + location.port;
			assertEqual(a.href, "http://example.com:" + location.port + "/p/q?x=1#f", "setting host");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: currentSrc reports the proxy URL. This was fixed in
		// "fix currentsrc leaking proxy url" (#183, c8f0e3f6), which is not in
		// this branch's history - regression test for that fix.
		name: "elurls-img-currentsrc",
		js: `
			const img = document.createElement("img");
			const done = new Promise((r) => { img.onload = r; img.onerror = r; });
			img.src = "/pic.png";
			document.body.appendChild(img);
			await done;
			assert(!img.currentSrc.includes("/~/sj/"),
				"currentSrc must not expose the proxy URL: " + img.currentSrc);
			assert(img.currentSrc === "" || img.currentSrc === location.origin + "/pic.png",
				"currentSrc: " + img.currentSrc);
		`,
	}),
	basicTest({
		name: "elurls-base-href-resolution",
		js: `
			const b = document.createElement("base");
			b.href = "/basedir/";
			document.head.appendChild(b);
			assertEqual(document.baseURI, location.origin + "/basedir/", "baseURI follows <base>");
			const a = document.createElement("a");
			a.href = "rel.html";
			assertEqual(a.href, location.origin + "/basedir/rel.html", "a relative href resolves against <base>");
			const img = document.createElement("img");
			img.src = "img.png";
			assertEqual(img.src, location.origin + "/basedir/img.png", "img src resolves against <base>");
			assertEqual(new URL("x", document.baseURI).href, location.origin + "/basedir/x", "new URL against baseURI");
		`,
	}),
	basicTest({
		name: "elurls-picture-source-selection",
		js: `
			const p = document.createElement("picture");
			p.innerHTML = '<source srcset="/wide.png" media="(min-width: 1px)"><img src="/fallback.png">';
			document.body.appendChild(p);
			await new Promise((r) => setTimeout(r, 300));
			const img = p.querySelector("img");
			assertEqual(p.querySelector("source").getAttribute("srcset"), "/wide.png", "source srcset attribute");
			assertEqual(img.getAttribute("src"), "/fallback.png", "img src attribute");
			assertEqual(p.innerHTML, '<source srcset="/wide.png" media="(min-width: 1px)"><img src="/fallback.png">',
				"picture serialization round trip");
			assert(String(img.currentSrc).includes("wide.png"),
				"the <source> candidate was selected over the fallback: " + img.currentSrc);
		`,
	}),
	basicTest({
		// KNOWN FAILURE: SVGAnimatedString.baseVal is absolutized instead of
		// returning the author's string. SVG sprite code reads use.href.baseVal to
		// find or swap the referenced symbol.
		name: "elurls-svg-use-baseval",
		js: `
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			use.setAttribute("href", "/sprite.svg#i");
			svg.appendChild(use);
			document.body.appendChild(svg);
			assertEqual(use.getAttribute("href"), "/sprite.svg#i", "the use href attribute");
			assertEqual(use.href.baseVal, "/sprite.svg#i", "SVGAnimatedString.baseVal");
		`,
	}),
];
