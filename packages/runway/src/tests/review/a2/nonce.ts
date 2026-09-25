import { basicTest } from "../../../testcommon.ts";

export default [
	basicTest({
		name: "rv2-nonce-remove-absent",
		js: `
			const s = document.createElement("script");
			s.nonce = "abc";
			s.removeAttribute("nonce");
			assertConsistent("after remove absent", s.nonce);
			const t = document.createElement("script");
			t.nonce = "q";
			t.toggleAttribute("nonce", false);
			assertConsistent("toggle false", t.nonce);
			const u = document.createElement("script");
			u.nonce = "z";
			u.removeAttributeNS(null, "nonce");
			assertConsistent("removeNS", u.nonce);
		`,
	}),
];
