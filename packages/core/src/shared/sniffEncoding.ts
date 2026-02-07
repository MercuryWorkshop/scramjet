/**
 * WHATWG Encoding Sniffing Algorithm
 *
 * Implements the encoding sniffing algorithm from the HTML spec:
 * https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding
 *
 * And the "algorithm for extracting a character encoding from a meta element":
 * https://html.spec.whatwg.org/multipage/urls-and-fetching.html#algorithm-for-extracting-a-character-encoding-from-a-meta-element
 *
 * And "get an encoding" from the Encoding spec:
 * https://encoding.spec.whatwg.org/#concept-encoding-get
 */

// https://encoding.spec.whatwg.org/#concept-encoding-get
// Maps all labels (lowercased, stripped of leading/trailing ASCII whitespace) to their encoding name.
// This is the full table from the Encoding spec §4.2.
const ENCODING_LABELS: Record<string, string> = {
	// UTF-8
	"unicode-1-1-utf-8": "UTF-8",
	unicode11utf8: "UTF-8",
	unicode20utf8: "UTF-8",
	"utf-8": "UTF-8",
	utf8: "UTF-8",
	"x-unicode20utf8": "UTF-8",

	// IBM866
	"866": "IBM866",
	cp866: "IBM866",
	csibm866: "IBM866",
	ibm866: "IBM866",

	// ISO-8859-2
	csisolatin2: "ISO-8859-2",
	"iso-8859-2": "ISO-8859-2",
	"iso-ir-101": "ISO-8859-2",
	"iso8859-2": "ISO-8859-2",
	iso88592: "ISO-8859-2",
	"iso_8859-2": "ISO-8859-2",
	"iso_8859-2:1987": "ISO-8859-2",
	l2: "ISO-8859-2",
	latin2: "ISO-8859-2",

	// ISO-8859-3
	csisolatin3: "ISO-8859-3",
	"iso-8859-3": "ISO-8859-3",
	"iso-ir-109": "ISO-8859-3",
	"iso8859-3": "ISO-8859-3",
	iso88593: "ISO-8859-3",
	"iso_8859-3": "ISO-8859-3",
	"iso_8859-3:1988": "ISO-8859-3",
	l3: "ISO-8859-3",
	latin3: "ISO-8859-3",

	// ISO-8859-4
	csisolatin4: "ISO-8859-4",
	"iso-8859-4": "ISO-8859-4",
	"iso-ir-110": "ISO-8859-4",
	"iso8859-4": "ISO-8859-4",
	iso88594: "ISO-8859-4",
	"iso_8859-4": "ISO-8859-4",
	"iso_8859-4:1988": "ISO-8859-4",
	l4: "ISO-8859-4",
	latin4: "ISO-8859-4",

	// ISO-8859-5
	csisolatincyrillic: "ISO-8859-5",
	cyrillic: "ISO-8859-5",
	"iso-8859-5": "ISO-8859-5",
	"iso-ir-144": "ISO-8859-5",
	"iso8859-5": "ISO-8859-5",
	iso88595: "ISO-8859-5",
	"iso_8859-5": "ISO-8859-5",
	"iso_8859-5:1988": "ISO-8859-5",

	// ISO-8859-6
	arabic: "ISO-8859-6",
	"asmo-708": "ISO-8859-6",
	csiso88596e: "ISO-8859-6",
	csiso88596i: "ISO-8859-6",
	csisolatinarabic: "ISO-8859-6",
	"ecma-114": "ISO-8859-6",
	"iso-8859-6": "ISO-8859-6",
	"iso-8859-6-e": "ISO-8859-6",
	"iso-8859-6-i": "ISO-8859-6",
	"iso-ir-127": "ISO-8859-6",
	"iso8859-6": "ISO-8859-6",
	iso88596: "ISO-8859-6",
	"iso_8859-6": "ISO-8859-6",
	"iso_8859-6:1987": "ISO-8859-6",

	// ISO-8859-7
	csisolatingreek: "ISO-8859-7",
	"ecma-118": "ISO-8859-7",
	elot_928: "ISO-8859-7",
	greek: "ISO-8859-7",
	greek8: "ISO-8859-7",
	"iso-8859-7": "ISO-8859-7",
	"iso-ir-126": "ISO-8859-7",
	"iso8859-7": "ISO-8859-7",
	iso88597: "ISO-8859-7",
	"iso_8859-7": "ISO-8859-7",
	"iso_8859-7:1987": "ISO-8859-7",
	sun_eu_greek: "ISO-8859-7",

	// ISO-8859-8
	csiso88598e: "ISO-8859-8",
	csisolatinhebrew: "ISO-8859-8",
	hebrew: "ISO-8859-8",
	"iso-8859-8": "ISO-8859-8",
	"iso-8859-8-e": "ISO-8859-8",
	"iso-ir-138": "ISO-8859-8",
	"iso8859-8": "ISO-8859-8",
	iso88598: "ISO-8859-8",
	"iso_8859-8": "ISO-8859-8",
	"iso_8859-8:1988": "ISO-8859-8",
	visual: "ISO-8859-8",

	// ISO-8859-8-I
	csiso88598i: "ISO-8859-8-I",
	"iso-8859-8-i": "ISO-8859-8-I",
	logical: "ISO-8859-8-I",

	// ISO-8859-10
	csisolatin6: "ISO-8859-10",
	"iso-8859-10": "ISO-8859-10",
	"iso-ir-157": "ISO-8859-10",
	"iso8859-10": "ISO-8859-10",
	iso885910: "ISO-8859-10",
	l6: "ISO-8859-10",
	latin6: "ISO-8859-10",

	// ISO-8859-13
	"iso-8859-13": "ISO-8859-13",
	"iso8859-13": "ISO-8859-13",
	iso885913: "ISO-8859-13",

	// ISO-8859-14
	"iso-8859-14": "ISO-8859-14",
	"iso8859-14": "ISO-8859-14",
	iso885914: "ISO-8859-14",

	// ISO-8859-15
	csisolatin9: "ISO-8859-15",
	"iso-8859-15": "ISO-8859-15",
	"iso8859-15": "ISO-8859-15",
	iso885915: "ISO-8859-15",
	"iso_8859-15": "ISO-8859-15",
	l9: "ISO-8859-15",

	// ISO-8859-16
	"iso-8859-16": "ISO-8859-16",

	// KOI8-R
	cskoi8r: "KOI8-R",
	koi: "KOI8-R",
	koi8: "KOI8-R",
	"koi8-r": "KOI8-R",
	koi8_r: "KOI8-R",

	// KOI8-U
	"koi8-ru": "KOI8-U",
	"koi8-u": "KOI8-U",

	// macintosh
	csmacintosh: "macintosh",
	mac: "macintosh",
	macintosh: "macintosh",
	"x-mac-roman": "macintosh",

	// windows-874
	"dos-874": "windows-874",
	"iso-8859-11": "windows-874",
	"iso8859-11": "windows-874",
	iso885911: "windows-874",
	"tis-620": "windows-874",
	"windows-874": "windows-874",

	// windows-1250
	cp1250: "windows-1250",
	"windows-1250": "windows-1250",
	"x-cp1250": "windows-1250",

	// windows-1251
	cp1251: "windows-1251",
	"windows-1251": "windows-1251",
	"x-cp1251": "windows-1251",

	// windows-1252
	"ansi_x3.4-1968": "windows-1252",
	ascii: "windows-1252",
	cp1252: "windows-1252",
	cp819: "windows-1252",
	csisolatin1: "windows-1252",
	ibm819: "windows-1252",
	"iso-8859-1": "windows-1252",
	"iso-ir-100": "windows-1252",
	"iso8859-1": "windows-1252",
	iso88591: "windows-1252",
	"iso_8859-1": "windows-1252",
	"iso_8859-1:1987": "windows-1252",
	l1: "windows-1252",
	latin1: "windows-1252",
	"us-ascii": "windows-1252",
	"windows-1252": "windows-1252",
	"x-cp1252": "windows-1252",

	// windows-1253
	cp1253: "windows-1253",
	"windows-1253": "windows-1253",
	"x-cp1253": "windows-1253",

	// windows-1254
	cp1254: "windows-1254",
	csisolatin5: "windows-1254",
	"iso-8859-9": "windows-1254",
	"iso-ir-148": "windows-1254",
	"iso8859-9": "windows-1254",
	iso88599: "windows-1254",
	"iso_8859-9": "windows-1254",
	"iso_8859-9:1989": "windows-1254",
	l5: "windows-1254",
	latin5: "windows-1254",
	"windows-1254": "windows-1254",
	"x-cp1254": "windows-1254",

	// windows-1255
	cp1255: "windows-1255",
	"windows-1255": "windows-1255",
	"x-cp1255": "windows-1255",

	// windows-1256
	cp1256: "windows-1256",
	"windows-1256": "windows-1256",
	"x-cp1256": "windows-1256",

	// windows-1257
	cp1257: "windows-1257",
	"windows-1257": "windows-1257",
	"x-cp1257": "windows-1257",

	// windows-1258
	cp1258: "windows-1258",
	"windows-1258": "windows-1258",
	"x-cp1258": "windows-1258",

	// x-mac-cyrillic
	"x-mac-cyrillic": "x-mac-cyrillic",
	"x-mac-ukrainian": "x-mac-cyrillic",

	// GBK
	chinese: "GBK",
	csgb2312: "GBK",
	csiso58gb231280: "GBK",
	gb2312: "GBK",
	gb_2312: "GBK",
	"gb_2312-80": "GBK",
	gbk: "GBK",
	"iso-ir-58": "GBK",
	"x-gbk": "GBK",

	// gb18030
	gb18030: "gb18030",

	// Big5
	big5: "Big5",
	"big5-hkscs": "Big5",
	"cn-big5": "Big5",
	csbig5: "Big5",
	"x-x-big5": "Big5",

	// EUC-JP
	cseucpkdfmtjapanese: "EUC-JP",
	"euc-jp": "EUC-JP",
	"x-euc-jp": "EUC-JP",

	// ISO-2022-JP
	csiso2022jp: "ISO-2022-JP",
	"iso-2022-jp": "ISO-2022-JP",

	// Shift_JIS
	csshiftjis: "Shift_JIS",
	ms932: "Shift_JIS",
	ms_kanji: "Shift_JIS",
	"shift-jis": "Shift_JIS",
	shift_jis: "Shift_JIS",
	sjis: "Shift_JIS",
	"windows-31j": "Shift_JIS",
	"x-sjis": "Shift_JIS",

	// EUC-KR
	cseuckr: "EUC-KR",
	csksc56011987: "EUC-KR",
	"euc-kr": "EUC-KR",
	"iso-ir-149": "EUC-KR",
	korean: "EUC-KR",
	"ks_c_5601-1987": "EUC-KR",
	"ks_c_5601-1989": "EUC-KR",
	ksc5601: "EUC-KR",
	ksc_5601: "EUC-KR",
	"windows-949": "EUC-KR",

	// replacement
	csiso2022kr: "replacement",
	"hz-gb-2312": "replacement",
	"iso-2022-cn": "replacement",
	"iso-2022-cn-ext": "replacement",
	"iso-2022-kr": "replacement",
	replacement: "replacement",

	// UTF-16BE
	unicodefffe: "UTF-16BE",
	"utf-16be": "UTF-16BE",

	// UTF-16LE
	csunicode: "UTF-16LE",
	"iso-10646-ucs-2": "UTF-16LE",
	"ucs-2": "UTF-16LE",
	unicode: "UTF-16LE",
	unicodefeff: "UTF-16LE",
	"utf-16": "UTF-16LE",
	"utf-16le": "UTF-16LE",

	// x-user-defined
	"x-user-defined": "x-user-defined",
};

/**
 * https://encoding.spec.whatwg.org/#concept-encoding-get
 *
 * "To get an encoding from a string label":
 * 1. Remove any leading and trailing ASCII whitespace from label.
 * 2. If label is an ASCII case-insensitive match for any of the labels listed
 *    in the table, return the corresponding encoding; otherwise return failure.
 */
export function getEncoding(label: string): string | null {
	const trimmed = label.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "");
	return ENCODING_LABELS[trimmed.toLowerCase()] ?? null;
}

/**
 * https://html.spec.whatwg.org/multipage/urls-and-fetching.html#algorithm-for-extracting-a-character-encoding-from-a-meta-element
 *
 * The algorithm for extracting a character encoding from a `meta` element,
 * given a string s.
 */
export function extractCharsetFromMeta(s: string): string | null {
	let position = 0;

	// Step 2: Loop — find "charset" (case-insensitive) after position
	while (true) {
		const idx = s.toLowerCase().indexOf("charset", position);
		if (idx === -1) return null;

		position = idx + "charset".length;

		// Step 3: Skip ASCII whitespace
		while (
			position < s.length &&
			(s[position] === "\t" ||
				s[position] === "\n" ||
				s[position] === "\f" ||
				s[position] === "\r" ||
				s[position] === " ")
		) {
			position++;
		}

		// Step 4: If next char is not '=', go back to loop
		if (position >= s.length || s[position] !== "=") {
			// Move position to just before the next character and re-loop
			continue;
		}

		// Skip the '='
		position++;

		// Step 5: Skip ASCII whitespace
		while (
			position < s.length &&
			(s[position] === "\t" ||
				s[position] === "\n" ||
				s[position] === "\f" ||
				s[position] === "\r" ||
				s[position] === " ")
		) {
			position++;
		}

		// Step 6: Process the next character
		if (position >= s.length) return null;

		const ch = s[position];

		if (ch === '"' || ch === "'") {
			// Find matching close quote
			const closeIdx = s.indexOf(ch, position + 1);
			if (closeIdx === -1) {
				// Unmatched quote
				return null;
			}
			const value = s.substring(position + 1, closeIdx);
			return getEncoding(value);
		}

		// Otherwise: collect until ASCII whitespace or semicolon or end
		let end = position;
		while (
			end < s.length &&
			s[end] !== "\t" &&
			s[end] !== "\n" &&
			s[end] !== "\f" &&
			s[end] !== "\r" &&
			s[end] !== " " &&
			s[end] !== ";"
		) {
			end++;
		}

		if (end === position) return null;

		const value = s.substring(position, end);
		return getEncoding(value);
	}
}

// Check if a byte is ASCII whitespace or slash (used in prescan)
function isSpaceOrSlash(byte: number): boolean {
	return (
		byte === 0x09 || // HT
		byte === 0x0a || // LF
		byte === 0x0c || // FF
		byte === 0x0d || // CR
		byte === 0x20 || // SP
		byte === 0x2f // /
	);
}

function isSpace(byte: number): boolean {
	return (
		byte === 0x09 || // HT
		byte === 0x0a || // LF
		byte === 0x0c || // FF
		byte === 0x0d || // CR
		byte === 0x20 // SP
	);
}

interface Attribute {
	name: string;
	value: string;
}

/**
 * https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding
 *
 * "Get an attribute" sub-algorithm used by the prescan algorithm.
 * Returns null if no attribute was found, or the attribute {name, value}.
 *
 * `pos` is an object with a `value` property so we can mutate it.
 */
function getAttribute(
	bytes: Uint8Array,
	pos: { value: number }
): Attribute | null {
	// Step 1: Skip spaces and slashes
	while (pos.value < bytes.length && isSpaceOrSlash(bytes[pos.value])) {
		pos.value++;
	}
	if (pos.value >= bytes.length) return null;

	// Step 2: If '>', no attribute
	if (bytes[pos.value] === 0x3e) return null;

	// Step 3: Start of attribute name
	let name = "";
	let value = "";

	// Step 4: Process bytes for attribute name
	while (pos.value < bytes.length) {
		const b = bytes[pos.value];

		if (b === 0x3d && name.length > 0) {
			// '=' and name is non-empty — advance and go to value
			pos.value++;
			break;
		}

		if (isSpace(b)) {
			// Go to "spaces" step
			pos.value++;
			goto_spaces();
			return finishFromSpaces();
		}

		if (b === 0x2f || b === 0x3e) {
			// '/' or '>' — attribute name only, empty value
			return { name, value: "" };
		}

		// A-Z -> lowercase
		if (b >= 0x41 && b <= 0x5a) {
			name += String.fromCharCode(b + 0x20);
		} else {
			name += String.fromCharCode(b);
		}

		pos.value++;
	}

	if (pos.value >= bytes.length) return null;

	// We got here because we found '=' — now parse value
	return parseValue();

	function goto_spaces() {
		// Step 6: Skip spaces
		while (pos.value < bytes.length && isSpace(bytes[pos.value])) {
			pos.value++;
		}
	}

	function finishFromSpaces(): Attribute | null {
		if (pos.value >= bytes.length) return null;

		// Step 7: If not '=', return name with empty value
		if (bytes[pos.value] !== 0x3d) {
			return { name, value: "" };
		}

		// Step 8: Advance past '='
		pos.value++;

		return parseValue();
	}

	function parseValue(): Attribute | null {
		// Step 9: Skip spaces before value
		while (pos.value < bytes.length && isSpace(bytes[pos.value])) {
			pos.value++;
		}
		if (pos.value >= bytes.length) return null;

		const b = bytes[pos.value];

		// Step 10: Check for quoted value
		if (b === 0x22 || b === 0x27) {
			// " or '
			const quoteChar = b;
			pos.value++;

			while (pos.value < bytes.length) {
				const qb = bytes[pos.value];
				if (qb === quoteChar) {
					pos.value++;
					return { name, value };
				}
				// A-Z -> lowercase
				if (qb >= 0x41 && qb <= 0x5a) {
					value += String.fromCharCode(qb + 0x20);
				} else {
					value += String.fromCharCode(qb);
				}
				pos.value++;
			}

			// Ran out of bytes inside quoted value
			return null;
		}

		// '>'
		if (b === 0x3e) {
			return { name, value: "" };
		}

		// A-Z -> lowercase for first char
		if (b >= 0x41 && b <= 0x5a) {
			value += String.fromCharCode(b + 0x20);
		} else {
			value += String.fromCharCode(b);
		}
		pos.value++;

		// Step 11: Unquoted value — collect until space or '>'
		while (pos.value < bytes.length) {
			const ub = bytes[pos.value];

			if (isSpace(ub) || ub === 0x3e) {
				return { name, value };
			}

			// A-Z -> lowercase
			if (ub >= 0x41 && ub <= 0x5a) {
				value += String.fromCharCode(ub + 0x20);
			} else {
				value += String.fromCharCode(ub);
			}
			pos.value++;
		}

		return { name, value };
	}
}

/**
 * https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding
 *
 * Prescan the first `limit` bytes of a byte stream to determine its encoding.
 * Returns an encoding name or null if none found.
 */
export function prescanByteStream(
	bytes: Uint8Array,
	limit: number = 1024
): string | null {
	const end = Math.min(bytes.length, limit);
	const pos = { value: 0 };

	// Step 2: Prescan for UTF-16 XML declarations
	if (
		end >= 6 &&
		bytes[0] === 0x3c &&
		bytes[1] === 0x00 &&
		bytes[2] === 0x3f &&
		bytes[3] === 0x00 &&
		bytes[4] === 0x78 &&
		bytes[5] === 0x00
	) {
		return "UTF-16LE";
	}
	if (
		end >= 6 &&
		bytes[0] === 0x00 &&
		bytes[1] === 0x3c &&
		bytes[2] === 0x00 &&
		bytes[3] === 0x3f &&
		bytes[4] === 0x00 &&
		bytes[5] === 0x78
	) {
		return "UTF-16BE";
	}

	// Step 3: Loop
	while (pos.value < end) {
		const b = bytes[pos.value];

		// Check for <!--
		if (
			b === 0x3c &&
			pos.value + 3 < end &&
			bytes[pos.value + 1] === 0x21 &&
			bytes[pos.value + 2] === 0x2d &&
			bytes[pos.value + 3] === 0x2d
		) {
			// Advance to first '>' preceded by '--'
			pos.value += 4;
			while (pos.value < end) {
				if (
					bytes[pos.value] === 0x3e &&
					pos.value >= 2 &&
					bytes[pos.value - 1] === 0x2d &&
					bytes[pos.value - 2] === 0x2d
				) {
					pos.value++;
					break;
				}
				pos.value++;
			}
			continue;
		}

		// Check for <meta (case-insensitive)
		if (
			b === 0x3c &&
			pos.value + 5 < end &&
			(bytes[pos.value + 1] === 0x4d || bytes[pos.value + 1] === 0x6d) && // M or m
			(bytes[pos.value + 2] === 0x45 || bytes[pos.value + 2] === 0x65) && // E or e
			(bytes[pos.value + 3] === 0x54 || bytes[pos.value + 3] === 0x74) && // T or t
			(bytes[pos.value + 4] === 0x41 || bytes[pos.value + 4] === 0x61) && // A or a
			isSpaceOrSlash(bytes[pos.value + 5])
		) {
			// Step: Advance position to the space/slash
			pos.value += 5;

			const attributeList: string[] = [];
			let gotPragma = false;
			let needPragma: boolean | null = null;
			let charset: string | null = null;

			// Attributes loop
			while (true) {
				const attr = getAttribute(bytes, pos);
				if (!attr) break;

				// Step 7: If already in list, skip
				if (attributeList.includes(attr.name)) continue;

				// Step 8: Add to list
				attributeList.push(attr.name);

				// Step 9: Process
				if (attr.name === "http-equiv") {
					if (attr.value === "content-type") {
						gotPragma = true;
					}
				} else if (attr.name === "content") {
					if (charset === null) {
						const extracted = extractCharsetFromMeta(attr.value);
						if (extracted !== null) {
							charset = extracted;
							needPragma = true;
						}
					}
				} else if (attr.name === "charset") {
					charset = getEncoding(attr.value);
					needPragma = false;
				}
			}

			// Processing steps
			// Step 11: If needPragma is null, skip
			if (needPragma === null) {
				pos.value++;
				continue;
			}

			// Step 12: If needPragma is true but gotPragma is false, skip
			if (needPragma === true && !gotPragma) {
				pos.value++;
				continue;
			}

			// Step 13: If charset is failure (null), skip
			if (charset === null) {
				pos.value++;
				continue;
			}

			// Step 14: If charset is UTF-16BE/LE, set to UTF-8
			if (charset === "UTF-16BE" || charset === "UTF-16LE") {
				charset = "UTF-8";
			}

			// Step 15: If charset is x-user-defined, set to windows-1252
			if (charset === "x-user-defined") {
				charset = "windows-1252";
			}

			// Step 16: Return charset
			return charset;
		}

		// Check for tag: < optionally /, then A-Z or a-z
		if (
			b === 0x3c &&
			pos.value + 1 < end &&
			(isAsciiAlpha(bytes[pos.value + 1]) ||
				(bytes[pos.value + 1] === 0x2f &&
					pos.value + 2 < end &&
					isAsciiAlpha(bytes[pos.value + 2])))
		) {
			// Advance to next space/tab/LF/FF/CR or >
			pos.value++;
			while (
				pos.value < end &&
				!isSpace(bytes[pos.value]) &&
				bytes[pos.value] !== 0x3e
			) {
				pos.value++;
			}
			// Get attributes until none
			while (pos.value < end) {
				const attr = getAttribute(bytes, pos);
				if (!attr) break;
			}
			continue;
		}

		// Check for <!, </, <?
		if (
			b === 0x3c &&
			pos.value + 1 < end &&
			(bytes[pos.value + 1] === 0x21 ||
				bytes[pos.value + 1] === 0x2f ||
				bytes[pos.value + 1] === 0x3f)
		) {
			// Advance to first '>'
			pos.value += 2;
			while (pos.value < end && bytes[pos.value] !== 0x3e) {
				pos.value++;
			}
			if (pos.value < end) pos.value++; // skip the >
			continue;
		}

		// Any other byte — do nothing, next byte
		pos.value++;
	}

	// If prescan didn't find anything, try get an XML encoding
	return getXmlEncoding(bytes, end);
}

function isAsciiAlpha(byte: number): boolean {
	return (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a);
}

/**
 * https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding
 *
 * "get an XML encoding" — invoked when the prescan algorithm aborts without
 * returning an encoding.
 */
function getXmlEncoding(bytes: Uint8Array, end: number): string | null {
	// Step 2: Check for <?xml
	if (
		end < 5 ||
		bytes[0] !== 0x3c || // <
		bytes[1] !== 0x3f || // ?
		bytes[2] !== 0x78 || // x
		bytes[3] !== 0x6d || // m
		bytes[4] !== 0x6c // l
	) {
		return null;
	}

	// Step 3: Find '>' for the xml declaration end
	let xmlEnd = -1;
	for (let i = 5; i < end; i++) {
		if (bytes[i] === 0x3e) {
			xmlEnd = i;
			break;
		}
	}
	if (xmlEnd === -1) return null;

	// Step 4: Find "encoding" in the xml declaration
	const declBytes = bytes.subarray(0, xmlEnd);
	let encPos = -1;
	const target = [0x65, 0x6e, 0x63, 0x6f, 0x64, 0x69, 0x6e, 0x67]; // "encoding"
	for (let i = 5; i <= declBytes.length - target.length; i++) {
		let match = true;
		for (let j = 0; j < target.length; j++) {
			if (declBytes[i + j] !== target[j]) {
				match = false;
				break;
			}
		}
		if (match) {
			encPos = i + target.length;
			break;
		}
	}
	if (encPos === -1) return null;

	// Step 6: Skip spaces/control chars (bytes <= 0x20)
	while (encPos < xmlEnd && declBytes[encPos] <= 0x20) {
		encPos++;
	}

	// Step 7: Must be '='
	if (encPos >= xmlEnd || declBytes[encPos] !== 0x3d) return null;
	encPos++;

	// Step 9: Skip spaces/control chars
	while (encPos < xmlEnd && declBytes[encPos] <= 0x20) {
		encPos++;
	}

	// Step 10-11: quoteMark must be " or '
	if (encPos >= xmlEnd) return null;
	const quoteMark = declBytes[encPos];
	if (quoteMark !== 0x22 && quoteMark !== 0x27) return null;
	encPos++;

	// Step 13: Find closing quote
	let encEnd = -1;
	for (let i = encPos; i < xmlEnd; i++) {
		if (declBytes[i] === quoteMark) {
			encEnd = i;
			break;
		}
	}
	if (encEnd === -1) return null;

	// Step 14: potentialEncoding
	const potentialEncoding = declBytes.subarray(encPos, encEnd);

	// Step 15: If it contains bytes <= 0x20, return failure
	for (let i = 0; i < potentialEncoding.length; i++) {
		if (potentialEncoding[i] <= 0x20) return null;
	}

	// Step 16: Get encoding
	const encodingName = String.fromCharCode(...potentialEncoding);
	let encoding = getEncoding(encodingName);

	// Step 17: If UTF-16BE/LE, change to UTF-8
	if (encoding === "UTF-16BE" || encoding === "UTF-16LE") {
		encoding = "UTF-8";
	}

	return encoding;
}

/**
 * https://encoding.spec.whatwg.org/#bom-sniff
 *
 * BOM sniff: check the first 2-3 bytes for a byte order mark.
 */
export function bomSniff(bytes: Uint8Array): string | null {
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xef &&
		bytes[1] === 0xbb &&
		bytes[2] === 0xbf
	) {
		return "UTF-8";
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		return "UTF-16BE";
	}
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		return "UTF-16LE";
	}
	return null;
}

/**
 * Extract the charset parameter from a Content-Type header value.
 *
 * This parses the Content-Type more carefully than a naive split — it handles
 * quoted values and multiple parameters.
 *
 * This follows what MIME Sniffing / HTTP specs say: find `charset=` parameter.
 */
export function extractCharsetFromContentType(
	contentType: string
): string | null {
	// Find the parameters section (after the first semicolon)
	const semicolonIdx = contentType.indexOf(";");
	if (semicolonIdx === -1) return null;

	let params = contentType.substring(semicolonIdx + 1);

	// We may have multiple parameters; iterate through them
	while (params.length > 0) {
		// Trim leading whitespace
		params = params.replace(/^[\t\n\f\r ]+/, "");

		// Try to find charset=
		const lower = params.toLowerCase();
		if (lower.startsWith("charset")) {
			let pos = "charset".length;

			// Skip whitespace
			while (
				pos < params.length &&
				(params[pos] === " " ||
					params[pos] === "\t" ||
					params[pos] === "\n" ||
					params[pos] === "\f" ||
					params[pos] === "\r")
			) {
				pos++;
			}

			if (pos < params.length && params[pos] === "=") {
				pos++;

				// Skip whitespace
				while (
					pos < params.length &&
					(params[pos] === " " ||
						params[pos] === "\t" ||
						params[pos] === "\n" ||
						params[pos] === "\f" ||
						params[pos] === "\r")
				) {
					pos++;
				}

				if (pos >= params.length) return null;

				// Quoted value
				if (params[pos] === '"') {
					pos++;
					let value = "";
					while (pos < params.length && params[pos] !== '"') {
						// Handle backslash escape in quoted string per HTTP spec
						if (params[pos] === "\\" && pos + 1 < params.length) {
							pos++;
						}
						value += params[pos];
						pos++;
					}
					return getEncoding(value);
				}

				// Unquoted value — collect until ; or end
				let value = "";
				while (
					pos < params.length &&
					params[pos] !== ";" &&
					params[pos] !== " " &&
					params[pos] !== "\t"
				) {
					value += params[pos];
					pos++;
				}
				return getEncoding(value);
			}
		}

		// Skip to next parameter
		const nextSemicolon = params.indexOf(";");
		if (nextSemicolon === -1) break;
		params = params.substring(nextSemicolon + 1);
	}

	return null;
}

/**
 * Determine the character encoding of an HTML document's byte stream.
 *
 * Implements a simplified version of the WHATWG encoding sniffing algorithm
 * for use in a service worker / proxy context:
 *
 * 1. BOM sniffing (certain)
 * 2. Transport layer: Content-Type header charset parameter (certain)
 * 3. Prescan byte stream: look for <meta charset> or
 *    <meta http-equiv="content-type" content="...charset=..."> in first 1024 bytes (tentative)
 * 4. Default to UTF-8
 *
 * Returns an encoding name suitable for use with TextDecoder.
 */
export function sniffEncoding(
	bytes: Uint8Array,
	contentTypeHeader: string | null
): string {
	// Step 1: BOM sniff
	const bom = bomSniff(bytes);
	if (bom) return bom;

	// Step 4: Transport layer (Content-Type header charset)
	if (contentTypeHeader) {
		const transportCharset = extractCharsetFromContentType(contentTypeHeader);
		if (transportCharset) return transportCharset;
	}

	// Step 5: Prescan
	const prescanResult = prescanByteStream(bytes, 1024);
	if (prescanResult) return prescanResult;

	// Step 9: Default
	return "UTF-8";
}
