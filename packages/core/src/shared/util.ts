import {
	atob,
	btoa,
	Function_apply,
	String_charCodeAt,
	String_fromCharCode,
	TextDecoder_decode,
	TextEncoder_encode,
	_Uint8Array,
} from "@/shared/snapshot";

// `String.fromCharCode.apply` is the fastest way to turn bytes into a latin1
// string, but the argument list is spread onto the stack, so it has to be fed
// in chunks or a large buffer overflows it
const APPLY_CHUNK = 0x8000;

function bytesToBase64Fallback(bytes: Uint8Array): string {
	let binString = "";
	for (let i = 0; i < bytes.length; i += APPLY_CHUNK) {
		binString += Function_apply(
			String_fromCharCode,
			null,
			bytes.subarray(i, i + APPLY_CHUNK)
		);
	}

	return btoa(binString);
}

function base64ToBytesFallback(base64: string): Uint8Array {
	const binString = atob(base64);
	const bytes = new _Uint8Array(binString.length);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = String_charCodeAt(binString, i);
	}

	return bytes;
}

const bytesToBase64Native: ((this: Uint8Array) => string) | undefined = (
	_Uint8Array.prototype as any
).toBase64;
const base64ToBytesNative: ((base64: string) => Uint8Array) | undefined = (
	_Uint8Array as any
).fromBase64;

export const bytesToBase64: (bytes: Uint8Array) => string =
	typeof bytesToBase64Native === "function"
		? (bytes) => bytesToBase64Native.call(bytes)
		: bytesToBase64Fallback;

export const base64ToBytes: (base64: string) => Uint8Array =
	typeof base64ToBytesNative === "function"
		? base64ToBytesNative
		: base64ToBytesFallback;

export function base64Encode(text: string) {
	return bytesToBase64(TextEncoder_encode(text));
}

/**
 * The inverse of {@link bytesToBase64} over text.
 *
 * Not `atob`: that answers one character per *byte*, so any source outside
 * latin1 comes back mojibake - `atob(bytesToBase64(encode("é")))` is "Ã©".
 * The bytes are UTF-8, so they have to be decoded as UTF-8.
 */
export function base64Decode(base64: string): string {
	return TextDecoder_decode(base64ToBytes(base64));
}
