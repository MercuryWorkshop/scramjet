import {
	btoa,
	TextEncoder_encode,
	String_fromCharCode,
} from "@/shared/snapshot";

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
