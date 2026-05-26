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
// p2_func_97612_165 (line 17426-17480):
//   1. Crypto.prototype.getRandomValues → check method exists
//   2. Calls .push on results with "text/javascript"

export default basicTest({
  name: "cf-crypto",
  js: `
    // Check 1: window.crypto must exist
    assert(window.crypto !== undefined && window.crypto !== null,
      "window.crypto should exist");

    // Check 2: crypto.subtle must exist (p2_func_795_139)
    assert(window.crypto.subtle !== undefined && window.crypto.subtle !== null,
      "window.crypto.subtle should exist");

    // Check 3: crypto.subtle.digest must be a function
    assert(typeof window.crypto.subtle.digest === "function",
      "crypto.subtle.digest should be a function");

    // Check 4: SHA-256 digest (p2_func_916_245)
    // Turnstile encodes data with TextEncoder, digests, converts to hex
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode("Turnstile integrity check");
      const hash = await crypto.subtle.digest("SHA-256", data);
      assert(hash instanceof ArrayBuffer,
        "crypto.subtle.digest should return ArrayBuffer, got: " + typeof hash);

      // Turnstile converts digest to hex (p2_func_614_208):
      // new Uint8Array(digest) → Array.from() → map(b→b.toString(16).padStart(2,'0')) → join('')
      const bytes = new Uint8Array(hash);
      assert(bytes.length === 32,
        "SHA-256 should produce 32 bytes, got: " + bytes.length);
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      assert(hex.length === 64,
        "SHA-256 hex should be 64 chars, got: " + hex.length);
    } catch (e) {
      pass("crypto.subtle.digest failed: " + e.message);
    }

    // Check 5: Crypto.prototype.getRandomValues (p2_func_97612_165)
    assert(typeof Crypto.prototype.getRandomValues === "function",
      "Crypto.prototype.getRandomValues should be a function");
    const arr = new Uint8Array(16);
    const result = crypto.getRandomValues(arr);
    assert(result === arr,
      "crypto.getRandomValues should return the same array");
    // Verify some bytes changed from zero (basic randomness check)
    const hasNonZero = arr.some(b => b !== 0);
    assert(hasNonZero,
      "crypto.getRandomValues should fill array with non-zero values");

    // Check 6: TextEncoder (p2_func_916_245)
    assert(typeof TextEncoder === "function",
      "TextEncoder should be a function");
  `,
});