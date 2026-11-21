import { basicTest } from "../testcommon.ts";

// A <style> grown the way CSS-in-JS grows one: a text node per rule, or
// appendData onto one node. Each node is rewritten on its own; the page reads
// back what it wrote, and the sheet applies.
export default [
	basicTest({
		name: "style-text-growth-node-per-rule",
		js: `
			const s = document.createElement("style");
			document.head.append(s);
			for (let i = 0; i < 20; i++) s.appendChild(document.createTextNode(".r" + i + "{width:" + i + "px;background:url(/img" + i + ".png)}"));
			const d = document.createElement("div"); d.className = "r7"; document.body.append(d);
			assertConsistent("text", s.textContent);
			assertConsistent("nodes", s.childNodes.length);
			assertConsistent("applied", getComputedStyle(d).width);
		`,
	}),
	basicTest({
		name: "style-text-growth-append-data",
		js: `
			const s = document.createElement("style");
			s.appendChild(document.createTextNode(""));
			document.head.append(s);
			for (let i = 0; i < 20; i++) s.firstChild.appendData(".a" + i + "{height:" + i + "px;background:url(/a" + i + ".png)}");
			const d = document.createElement("div"); d.className = "a5"; document.body.append(d);
			assertConsistent("text", s.textContent);
			assertConsistent("applied", getComputedStyle(d).height);
		`,
	}),
	basicTest({
		name: "style-text-growth-url-across-nodes",
		js: `
			const s = document.createElement("style");
			document.head.append(s);
			s.appendChild(document.createTextNode(".x{background:url(/spl"));
			s.appendChild(document.createTextNode("it.png);width:3px}"));
			const d = document.createElement("div"); d.className = "x"; document.body.append(d);
			assertConsistent("text", s.textContent);
			assertConsistent("applied", getComputedStyle(d).width);
		`,
	}),
];
