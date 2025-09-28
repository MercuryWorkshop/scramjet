import { browser } from "../Browser";
import { scramjet } from "../main";

export type OmniboxResult = {
	kind: "search" | "history" | "bookmark" | "direct";
	title?: string | null;
	url: URL;
	favicon?: string | null;
	relevanceScore?: number;
};

function calculateRelevanceScore(result: OmniboxResult, query: string): number {
	if (!query) return 0;

	const lowerQuery = query.toLowerCase();
	const urlString = result.url.href.toLowerCase();
	const title = result.title?.toLowerCase() || "";

	let score = 0;

	if (urlString === lowerQuery || title === lowerQuery) {
		return 100;
	}

	if (result.kind === "direct") {
		return 90;
	}

	if (result.kind === "bookmark") {
		score += 20;
	}

	if (result.kind === "history") {
		score += 10;
	}

	if (result.url.hostname.includes(lowerQuery)) {
		score += 40;
	}

	if (title.startsWith(lowerQuery)) {
		score += 30;
	}

	if (result.url.pathname.toLowerCase().startsWith(lowerQuery)) {
		score += 25;
	}

	if (title.includes(lowerQuery)) {
		score += 15;
	}

	if (urlString.includes(lowerQuery)) {
		score += 10;
	}

	return score;
}

function rankResults(results: OmniboxResult[], query: string): OmniboxResult[] {
	return results
		.map((result) => ({
			...result,
			relevanceScore: calculateRelevanceScore(result, query),
		}))
		.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}
let cachedGoogleResults: OmniboxResult[] = [];

const fetchHistoryResults = (query: string): OmniboxResult[] => {
	if (!query) return [];

	const results: OmniboxResult[] = [];
	const lowerQuery = query.toLowerCase();

	for (const entry of browser.globalhistory) {
		const urlMatch = entry.url.href.toLowerCase().includes(lowerQuery);
		const titleMatch = entry.title?.toLowerCase()?.includes(lowerQuery);

		if (!urlMatch && !titleMatch) continue;
		if (results.some((i) => i.url.href === entry.url.href)) continue;

		results.push({
			kind: "history",
			title: entry.title,
			url: entry.url,
			favicon: entry.favicon,
		});
	}

	return results.slice(0, 5);
};

const addDirectUrlResult = (
	query: string,
	results: OmniboxResult[]
): OmniboxResult[] => {
	if (URL.canParse(query)) {
		return [
			{
				kind: "direct",
				url: new URL(query),
			},
			...results,
		];
	}

	return results;
};

const fetchGoogleSuggestions = async (
	query: string
): Promise<OmniboxResult[]> => {
	if (!query) return [];

	try {
		const resp = await fetch(
			scramjet.encodeUrl(
				`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
			)
		);

		const json = await resp.json();
		const suggestions: OmniboxResult[] = [];

		for (const item of json[1].slice(0, 5)) {
			// it's gonna be stuff like "http //fortnite.com/2fa ps5"
			// generally not useful
			if (item.startsWith("http")) continue;

			suggestions.push({
				kind: "search",
				title: item,
				url: new URL(
					`https://www.google.com/search?q=${encodeURIComponent(item)}`
				),
			});
		}

		return suggestions;
	} catch (error) {
		console.error("Error fetching Google suggestions:", error);

		return [];
	}
};

export async function fetchSuggestions(
	query: string,
	setResults: (results: OmniboxResult[]) => void
) {
	if (!query) {
		setResults([]);

		return;
	}

	const historyResults = fetchHistoryResults(query);

	let combinedResults: OmniboxResult[] = [
		...historyResults,
		...cachedGoogleResults,
	];

	combinedResults = addDirectUrlResult(query, combinedResults);

	// first update, so the user sees something quickly
	setResults(rankResults(combinedResults, query));

	const googleResults = await fetchGoogleSuggestions(query);

	combinedResults = [...historyResults, ...googleResults];
	combinedResults = addDirectUrlResult(query, combinedResults);

	// update with the new google results
	setResults(rankResults(combinedResults, query));
	cachedGoogleResults = googleResults;
}
