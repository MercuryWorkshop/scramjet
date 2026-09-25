import { t } from "./net.ts";
/* eslint-disable quotes */
const w = `await new Promise(r => setTimeout(r, 400));`;
export default [
	t(
		"rv4-hash-setter-hash",
		`
		let hc = 0; addEventListener("hashchange", () => hc++);
		location.hash = "h1";
		${w}
		assertEqual(location.hash, "#h1", "hash");
		assertEqual(hc, 1, "hashchange");
	`
	),
	t(
		"rv4-hash-link-click",
		`
		let hc = 0; addEventListener("hashchange", () => hc++);
		const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click();
		${w}
		assertEqual(location.hash, "#h2", "hash via link");
		assertEqual(hc, 1, "hashchange");
	`
	),
	t(
		"rv4-hash-href-assign",
		`
		location.href = "#h3";
		${w}
		assertEqual(location.hash, "#h3", "href hash");
	`
	),
	t(
		"rv4-hash-assign-fn",
		`
		location.assign("#h4");
		${w}
		assertEqual(location.hash, "#h4", "assign hash");
	`
	),
	t(
		"rv4-hash-replace-fn",
		`
		location.replace("#h5");
		${w}
		assertEqual(location.hash, "#h5", "replace hash");
	`
	),
	t(
		"rv4-hash-link-full-url",
		`
		const a = document.createElement("a"); a.href = location.href.split("#")[0] + "#h6"; document.body.appendChild(a); a.click();
		${w}
		assertEqual(location.hash, "#h6", "full url + hash link");
	`
	),
];
