import { t } from "./net.ts";
/* eslint-disable quotes */
const rv = (label, expr) => `
	try { URL.revokeObjectURL(${expr}); } catch (e) { errs.push(${JSON.stringify(label)} + ": " + e); }
`;
export default [
	t(
		"rv4-g-revoke-non-blob",
		`
		const errs = [];
		${rv("empty", '""')}
		${rv("https", '"https://example.com/a.png"')}
		${rv("undefined", "undefined")}
		${rv("null", "null")}
		${rv("data", '"data:text/plain,hi"')}
		${rv("relative", '"/foo"')}
		${rv("blob-bad", '"blob:nonsense"')}
		assertEqual(errs.join(" | "), "", "revokeObjectURL never throws natively");
	`
	),
	t(
		"rv4-g-revoke-roundtrip",
		`
		const u = URL.createObjectURL(new Blob(["x"]));
		assert(u.startsWith("blob:" + location.origin + "/"), "blob origin: " + u);
		URL.revokeObjectURL(u);
		const img = document.createElement("img");
		img.src = URL.createObjectURL(new Blob(["y"]));
		URL.revokeObjectURL(img.src);
	`
	),
];
