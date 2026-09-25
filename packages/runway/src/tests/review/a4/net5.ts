import { t } from "./net.ts";
/* eslint-disable quotes */
const to = (p, ms, m) =>
	`await Promise.race([${p}, new Promise((_, rej) => setTimeout(() => rej(new Error(${JSON.stringify(m)})), ${ms}))])`;
export default [
	t(
		"rv4-e-cs-listener-then-set",
		`
		if (!("cookieStore" in window)) return;
		cookieStore.addEventListener("change", () => {});
		${to('cookieStore.set("chg", "1")', 3000, "set hung after addEventListener")};
	`
	),
	t(
		"rv4-e-cs-set-plain",
		`
		if (!("cookieStore" in window)) return;
		${to('cookieStore.set("chg2", "1")', 3000, "plain set hung")};
		${to('cookieStore.get("chg2")', 3000, "get hung")};
	`
	),
	t(
		"rv4-e-cs-listener-only",
		`
		if (!("cookieStore" in window)) return;
		let n = 0;
		cookieStore.addEventListener("change", () => n++);
		await new Promise(r => setTimeout(r, 500));
		assertEqual(n, 0, "no spurious events");
	`
	),
];
