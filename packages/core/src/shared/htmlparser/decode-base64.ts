import { atob, String_charCodeAt, Uint16Array } from "../snapshot";

/**
 * Shared base64 decode helper for generated decode data.
 * @param input Input string to encode or decode.
 */
export function decodeBase64(input: string): Uint16Array {
    const binary: string = atob(input);
    const evenLength = binary.length & ~1; // Round down to even length
    const out = new Uint16Array(evenLength / 2);

    for (let index = 0, outIndex = 0; index < evenLength; index += 2) {
        const lo = String_charCodeAt(binary, index);
        const hi = String_charCodeAt(binary, index + 1);
        out[outIndex++] = lo | (hi << 8);
    }

    return out;
}
