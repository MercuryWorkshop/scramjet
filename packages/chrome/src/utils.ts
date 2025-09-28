import { parse } from "tldts";

export function formatBytes(bytes: number, decimals: number = 2): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return (
		parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
	);
}

export function emToPx(
	em: number | string,
	element: HTMLElement = document.body
): number {
	const computedStyle = getComputedStyle(element);

	// Handle CSS variable input like var(--some-variable)
	if (typeof em === "string" && em.startsWith("var(") && em.endsWith(")")) {
		// Extract the variable name from var(--name)
		const varName = em.substring(4, em.length - 1);
		// Get the computed value of the CSS variable
		const varValue = computedStyle.getPropertyValue(varName).trim();

		if (varValue) {
			// If the value ends with 'em', parse it as em
			if (varValue.endsWith("em")) {
				em = parseFloat(varValue);
			}
			// If the value is in px, return it directly
			else if (varValue.endsWith("px")) {
				return parseFloat(varValue);
			}
			// For other units or invalid values, default to 0
			else {
				return 0;
			}
		} else {
			return 0; // CSS variable not found
		}
	}

	const fontSize = parseFloat(computedStyle.fontSize);
	return (typeof em === "number" ? em : 0) * fontSize;
}

// subdomain, domain+tld+port, path+search+query
export function splitUrl(url: URL): [string, string, string] {
	let last = url.pathname + url.search + url.hash;
	if (last == "/") last = "";

	let results = parse(url.href);
	let domain = results.domain;
	if (domain && url.port) {
		domain += ":" + url.port;
	}
	let subdomain = results.subdomain;
	if (subdomain) {
		subdomain += ".";
	}

	return [subdomain || "", domain || "", last];
}
