import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-hash4-orig",
		`
		window.alive = 1;
		let hc = 0; addEventListener("hashchange", () => hc++);
		location.hash = "h1";
		await new Promise(r => setTimeout(r, 300));
		assertEqual(location.hash, "#h1", "hash");
		assert(hc === 1, "hashchange " + hc);
		const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click();
		await new Promise(r => setTimeout(r, 300));
		assertEqual(location.hash, "#h2", "hash via link");
		assertEqual(hc, 2, "hashchange 2");
		location.href = "#h3";
		await new Promise(r => setTimeout(r, 300));
		assertEqual(location.hash, "#h3", "href hash");
		assertEqual(a.href, location.origin + "/#h2", "a.href");
	`
	),
];
