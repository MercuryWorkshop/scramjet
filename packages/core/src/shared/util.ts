import {
	Array_from,
	atob,
	btoa,
	String_charCodeAt,
	String_fromCharCode,
	String_fromCodePoint,
	TextDecoder_decode,
	TextEncoder_encode,
	_Uint8Array,
} from "@/shared/snapshot";

function bytesToBase64Fallback(bytes: Uint8Array): string {
	const binString = Array_from(bytes, (byte) =>
		String_fromCodePoint(byte)
	).join("");

	return btoa(binString);
}

const bytesToBase64Native: ((this: Uint8Array) => string) | undefined = (
	Uint8Array.prototype as any
).toBase64;

export const bytesToBase64: (bytes: Uint8Array) => string =
	typeof bytesToBase64Native === "function"
		? (bytes) => bytesToBase64Native.call(bytes)
		: bytesToBase64Fallback;

export function base64Encode(text: string) {
	return btoa(
		TextEncoder_encode(text)
			.reduce(
				(data, byte) => (data.push(String_fromCharCode(byte)), data),
				[] as any
			)
			.join("")
	);
}

const bytesFromBase64Native: ((base64: string) => Uint8Array) | undefined = (
	_Uint8Array as any
).fromBase64;

function base64ToBytesFallback(base64: string): Uint8Array {
	const binString = atob(base64);

	return _Uint8Array.from(binString, (character: string) =>
		String_charCodeAt(character, 0)
	) as Uint8Array;
}

export const base64ToBytes: (base64: string) => Uint8Array =
	typeof bytesFromBase64Native === "function"
		? (base64) => bytesFromBase64Native(base64)
		: base64ToBytesFallback;

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
