import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-hash3-combined",
		`
		console.log("RUN", location.href, sessionStorage.rv4h3 = (+(sessionStorage.rv4h3||0)+1));
		let hc = 0; addEventListener("hashchange", () => hc++);
		location.hash = "h1";
		await new Promise(r => setTimeout(r, 300));
		const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click();
		await new Promise(r => setTimeout(r, 300));
		assertEqual(location.hash, "#h2", "hash via link");
		assertEqual(hc, 2, "hashchange 2");
	`
	),
];
