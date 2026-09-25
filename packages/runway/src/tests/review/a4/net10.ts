import { t } from "./net.ts";
/* eslint-disable quotes */
export default [
	t(
		"rv4-j-perf",
		`
		for (let i = 0; i < 30; i++) document.cookie = "c" + i + "=" + "v".repeat(20);
		let t0 = performance.now();
		for (let i = 0; i < 20000; i++) document.cookie;
		const cookieRead = performance.now() - t0;
		t0 = performance.now();
		for (let i = 0; i < 500; i++) document.cookie = "w=" + i;
		const cookieWrite = performance.now() - t0;
		const r = await fetch("/text");
		t0 = performance.now();
		for (let i = 0; i < 20000; i++) r.headers.get("content-type");
		const hget = performance.now() - t0;
		t0 = performance.now();
		for (let i = 0; i < 2000; i++) [...r.headers];
		const hiter = performance.now() - t0;
		t0 = performance.now();
		for (let i = 0; i < 20000; i++) new Request("/x" + i);
		const req = performance.now() - t0;
		t0 = performance.now();
		const ps = []; for (let i = 0; i < 300; i++) ps.push(fetch("/text").then(r => r.text()));
		await Promise.all(ps);
		const par = performance.now() - t0;
		fail(JSON.stringify({ cookieRead, cookieWrite, hget, hiter, req, par }));
	`
	),
];
