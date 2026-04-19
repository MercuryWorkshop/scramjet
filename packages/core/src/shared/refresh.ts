/**
 * this is vibe slop for parsing the content of a meta refresh element, which is a bit of a mess
 * @see https://html.spec.whatwg.org/multipage/semantics.html#the-meta-element:the-declarative-refresh-syntax
 */
import { Number_parseInt } from "./snapshot";
export type ParsedDeclarativeRefresh = {
	time: number;
	urlStart: number;
	urlEnd: number;
	url: string | null;
};

function isAsciiWhitespace(codePoint: number): boolean {
	return (
		codePoint === 0x09 ||
		codePoint === 0x0a ||
		codePoint === 0x0c ||
		codePoint === 0x0d ||
		codePoint === 0x20
	);
}

function skipAsciiWhitespace(input: string, position: number): number {
	while (position < input.length) {
		if (!isAsciiWhitespace(input.charCodeAt(position))) {
			break;
		}
		position += 1;
	}

	return position;
}

function isAsciiDigit(codePoint: number): boolean {
	return codePoint >= 0x30 && codePoint <= 0x39;
}

function isAsciiAlpha(codePoint: number): boolean {
	return (
		(codePoint >= 0x41 && codePoint <= 0x5a) ||
		(codePoint >= 0x61 && codePoint <= 0x7a)
	);
}

export function parseDeclarativeRefresh(
	input: string
): ParsedDeclarativeRefresh | null {
	if (input.length === 0) {
		return null;
	}

	let position = 0;
	position = skipAsciiWhitespace(input, position);

	const timeStart = position;
	while (position < input.length && isAsciiDigit(input.charCodeAt(position))) {
		position += 1;
	}
	const timeString = input.slice(timeStart, position);

	if (timeString.length === 0) {
		if (input.charCodeAt(position) !== 0x2e) {
			return null;
		}
	}

	const time = timeString.length > 0 ? Number_parseInt(timeString, 10) : 0;

	while (position < input.length) {
		const codePoint = input.charCodeAt(position);
		if (isAsciiDigit(codePoint) || codePoint === 0x2e) {
			position += 1;
			continue;
		}
		break;
	}

	if (position >= input.length) {
		return {
			time,
			urlStart: -1,
			urlEnd: -1,
			url: null,
		};
	}

	const separator = input.charCodeAt(position);
	if (
		separator !== 0x3b &&
		separator !== 0x2c &&
		!isAsciiWhitespace(separator)
	) {
		return null;
	}

	position = skipAsciiWhitespace(input, position);
	if (position < input.length) {
		const maybeSeparator = input.charCodeAt(position);
		if (maybeSeparator === 0x3b || maybeSeparator === 0x2c) {
			position += 1;
		}
	}
	position = skipAsciiWhitespace(input, position);

	if (position >= input.length) {
		return {
			time,
			urlStart: -1,
			urlEnd: -1,
			url: null,
		};
	}

	let urlPosition = position;
	const urlLabel = input.slice(position, position + 3);
	if (urlLabel.length === 3) {
		const first = input.charCodeAt(position);
		const second = input.charCodeAt(position + 1);
		const third = input.charCodeAt(position + 2);
		const hasUrlLabel =
			isAsciiAlpha(first) &&
			isAsciiAlpha(second) &&
			isAsciiAlpha(third) &&
			(urlLabel[0] === "U" || urlLabel[0] === "u") &&
			(urlLabel[1] === "R" || urlLabel[1] === "r") &&
			(urlLabel[2] === "L" || urlLabel[2] === "l");

		if (hasUrlLabel) {
			let next = position + 3;
			next = skipAsciiWhitespace(input, next);
			if (input.charCodeAt(next) === 0x3d) {
				next += 1;
				next = skipAsciiWhitespace(input, next);
				urlPosition = next;
			}
		}
	}

	let quote = "";
	if (urlPosition < input.length) {
		const quoteCode = input.charCodeAt(urlPosition);
		if (quoteCode === 0x22 || quoteCode === 0x27) {
			quote = input[urlPosition];
			urlPosition += 1;
		}
	}

	let urlEnd = input.length;
	if (quote !== "") {
		const closingQuote = input.indexOf(quote, urlPosition);
		if (closingQuote !== -1) {
			urlEnd = closingQuote;
		}
	}

	const url = input.slice(urlPosition, urlEnd);

	return {
		time,
		urlStart: urlPosition,
		urlEnd,
		url,
	};
}
