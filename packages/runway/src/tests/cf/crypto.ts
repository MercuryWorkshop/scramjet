import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_795_139 (line 604-616):
//   1. window.crypto.subtle → check existence
//   2. if subtle exists → p2_func_916_245 (do SHA-256 digest)
//   3. else → Promise.resolve(KDHTz3(data)) fallback
//
// p2_func_799_23 (line 27465-27476):
//   Same check but on (0).crypto.subtle (iframe context)
//
// p2_func_916_245 (line 577-586):
//   1. new TextEncoder().encode(data)
//   2. crypto.subtle.digest("SHA-256", encoded)
//   3. digest.then(p2_func_614_208) → process hash
//
// p2_func_614_208 (line 588-596):
//   1. new Uint8Array(digestBuffer)
//   2. Array.from(bytes).map(b→b.toString(16).padStart(2,'0'))
//   3. .join("") → hex string
//
export default basicTest({
	name: "cf-crypto",
	js: `
		// p2_func_742_236 / p2_func_795_139 branch on window.crypto.subtle.
		const hasSubtleDigest = !!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest);
		assertConsistent("crypto-subtle-digest-present", hasSubtleDigest);
		assert(typeof Crypto.prototype.getRandomValues === "function",
			"Crypto.prototype.getRandomValues should be a function");

		if (hasSubtleDigest) {
			// p2_func_916_245 encodes the input and calls crypto.subtle.digest("SHA-256", ...).
			const encoder = new TextEncoder();
			const data = encoder.encode("Turnstile integrity check");
			const hash = await crypto.subtle.digest("SHA-256", data);
			assert(hash instanceof ArrayBuffer,
				"crypto.subtle.digest should return ArrayBuffer, got: " + typeof hash);

			// p2_func_614_208 / p2_func_526_142 convert the digest bytes to hex.
			const bytes = new Uint8Array(hash);
			const hex = Array.from(bytes)
				.map(b => b.toString(16).padStart(2, "0"))
				.join("");

			assertConsistent("crypto-sha256-hex", hex);
		}
	`,
});
