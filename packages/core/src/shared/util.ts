import {
	Array_from,
	btoa,
	TextEncoder_encode,
	String_fromCharCode,
	String_fromCodePoint,
} from "@/shared/snapshot";

function bytesToBase64Fallback(bytes: Uint8Array): string {
	const binString = Array_from(bytes, (byte) =>
		String_fromCodePoint(byte)
	).join("");

	return btoa(binString);
}

const bytesToBase64Native: ((this: Uint8Array) => string) | undefined =
	(Uint8Array.prototype as any).toBase64;

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
