import {
	btoa,
	TextEncoder_encode,
	String_fromCharCode,
	Math_random,
} from "@/shared/snapshot";

export function generateClientId(): string {
	return Math_random().toString(36).substring(2, 8);
}

export function base64Encode(text: string) {
	return btoa(
		TextEncoder_encode(text)
			.encode(text)
			.reduce(
				(data, byte) => (data.push(String_fromCharCode(byte)), data),
				[] as any
			)
			.join("")
	);
}
