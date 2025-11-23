import { type URLMeta } from "@rewriters/url";

import type {
	default as BareClient,
	BareResponseFetch,
} from "@mercuryworkshop/bare-mux";
import { ScramjetDB } from "@/types";
import { openDB, IDBPDatabase } from "idb";

const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const CACHE_DURATION_MINUTES = 60 * 24; // official cache duration
const CACHE_KEY = "publicSuffixList";

/**
 * Gets a connection to the IndexedDB database
 *
 * @returns Resolves to the database connection
 */
async function getDB(): Promise<IDBPDatabase<ScramjetDB>> {
	return openDB<ScramjetDB>("$scramjet", 1);
}

/**
 * Gets cached Public Suffix List
 *
 * @returns Cached Public Suffix List data if not expired, or `null`
 */
async function getCachedSuffixList(): Promise<{
	data: string[];
	expiry: number;
} | null> {
	const db = await getDB();
	return (await db.get("publicSuffixList", CACHE_KEY)) || null;
}

/**
 * Stores public suffix list
 *
 * @param data Public Suffix list data to cache
 */
async function setCachedSuffixList(data: string[]): Promise<void> {
	const db = await getDB();
	await db.put(
		"publicSuffixList",
		{
			data,
			expiry: Date.now() + CACHE_DURATION_MINUTES * 60 * 1000,
		},
		CACHE_KEY
	);
}

/**
 * Emulate `Sec-Fetch-Site` header using the referrer (another reason why Force Referrer is now a needed SJ feature)
 */
export async function getSiteDirective(
	meta: URLMeta,
	referrerURL: URL,
	client: BareClient
): Promise<string> {
	if (!referrerURL) {
		return "none";
	}

	if (meta.origin.origin === referrerURL.origin) {
		return "same-origin";
	}

	const sameSite = await isSameSite(meta.origin, referrerURL, client);
	if (sameSite) {
		return "same-site";
	}

	return "cross-site";
}

/**
 * Tests if the two URLs are from the same site.
 * This will be used in the response header rewriter.
 *
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Site
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site#directives
 *
 * @param url1 First URL to compare
 * @param url2 Second URL to compare
 * @param client `BareClient` instance used for fetching
 * @returns Whether the two URLs are from the same site
 *
 * @throws {Error} If an error occurs while getting the Public Suffix List
 */
export async function isSameSite(
	url1: URL,
	url2: URL,
	client: BareClient
): Promise<boolean> {
	const registrableDomain1 = await getRegistrableDomain(url1, client);
	const registrableDomain2 = await getRegistrableDomain(url2, client);

	return registrableDomain1 === registrableDomain2;
}

/**
 * Gets the registrable domain (eTLD+1) for a URL
 * @param url URL to get registrable domain for
 * @param client `BareClient` instance for fetching public suffix list
 * @returns Registrable domain
 */
async function getRegistrableDomain(
	url: URL,
	client: BareClient
): Promise<string> {
	const publicSuffixes = await getPublicSuffixList(client);

	const hostname = url.hostname.toLowerCase();
	const labels = hostname.split(".");
	let matchedSuffix = "";

	let isException = false;
	for (const suffix of publicSuffixes) {
		const actualSuffix = suffix.startsWith("!") ? suffix.substring(1) : suffix;
		const suffixLabels = actualSuffix.split(".");

		if (matchesSuffix(labels, suffixLabels)) {
			if (suffix.startsWith("!")) {
				matchedSuffix = actualSuffix;
				isException = true;
				break;
			}
			if (!isException && actualSuffix.length > matchedSuffix.length) {
				matchedSuffix = actualSuffix;
			}
		}
	}

	if (!matchedSuffix) {
		return labels.slice(-2).join(".");
	}

	const suffixLabelCount = matchedSuffix.split(".").length;
	const domainLabelCount = isException
		? suffixLabelCount
		: suffixLabelCount + 1;

	return labels.slice(-domainLabelCount).join(".");
}

/**
 * Checks if hostname labels match a suffix pattern
 * @param hostnameLabels Labels of the hostname (split by `.`)
 * @param suffixLabels Labels of the suffix pattern (split by `.`)
 * @returns Whether the hostname matches the suffix
 */
function matchesSuffix(
	hostnameLabels: string[],
	suffixLabels: string[]
): boolean {
	if (hostnameLabels.length < suffixLabels.length) {
		return false;
	}

	const offset = hostnameLabels.length - suffixLabels.length;
	for (let i = 0; i < suffixLabels.length; i++) {
		const hostLabel = hostnameLabels[offset + i];
		const suffixLabel = suffixLabels[i];

		if (suffixLabel === "*") {
			continue;
		}

		if (hostLabel !== suffixLabel) {
			return false;
		}
	}

	return true;
}

async function fetchPublicSuffixList(client: BareClient): Promise<Response> {
	let response: Response;

	const processFetch = (promise: Promise<Response>) =>
		promise
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Error ${response.status}`);
				}

				return response;
			})
			.catch((err) => {
				throw new Error(`Failed to fetch PSL: ${err}`);
			});

	try {
		response = await processFetch(fetch(PSL_URL));
	} catch {
		response = await processFetch(client.fetch(PSL_URL));
	}

	return response;
}
async function loadPublicSuffixList(client: BareClient): Promise<string[]> {
	const cached = await getCachedSuffixList();
	if (cached && Date.now() < cached.expiry) {
		return cached.data;
	}

	const publicSuffixesResponse = await fetchPublicSuffixList(client);
	const publicSuffixesRaw = await publicSuffixesResponse.text();

	const publicSuffixes = publicSuffixesRaw
		.split("\n")
		.map((line) => {
			const trimmed = line.trim();
			const spaceIndex = trimmed.indexOf(" ");

			return spaceIndex > -1 ? trimmed.substring(0, spaceIndex) : trimmed;
		})
		.filter((line) => line && !line.startsWith("//"));

	await setCachedSuffixList(publicSuffixes);

	return publicSuffixes;
}

let pslPromise: Promise<string[]> | undefined;
/**
 * Gets parsed Public Suffix list from the API.
 *
 * Complies with the standard format.
 * @see https://github.com/publicsuffix/list/wiki/Format#format
 *
 * @param {BareClient} client `BareClient` instance used for fetching
 * @returns {Promise<string[]>} Parsed Public Suffix list
 *
 * @throws {Error} If an error occurs while fetching from the Public Suffix List
 */
export function getPublicSuffixList(
	client: BareClient
): Promise<string[]> {
	if (pslPromise) {
		return pslPromise;
	}

	pslPromise = loadPublicSuffixList(client).finally(() => {
		pslPromise = undefined;
	});

	return pslPromise;
}
