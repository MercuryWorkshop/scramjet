import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-hash7-diag",
		`
		const logk = "rv4h7";
		const prev = sessionStorage.getItem(logk);
		const L = (s) => sessionStorage.setItem(logk, (sessionStorage.getItem(logk) || "") + "|" + s);
		if (prev && prev.includes("start")) { const p = prev; sessionStorage.removeItem(logk); fail("reloaded after: " + p + " now=" + location.hash); return; }
		L("start");
		let hc = 0; addEventListener("hashchange", () => hc++);
		location.hash = "h1"; L("set-h1");
		await new Promise(r => setTimeout(r, 300)); L("after-h1 hc=" + hc);
		const a = document.createElement("a"); a.href = "#h2"; document.body.appendChild(a); a.click(); L("clicked");
		await new Promise(r => setTimeout(r, 300)); L("after-click hc=" + hc + " " + location.hash);
		location.href = "#h3"; L("href-h3");
		await new Promise(r => setTimeout(r, 300)); L("after-h3 hc=" + hc + " " + location.hash);
		sessionStorage.removeItem(logk);
	`
	),
];
