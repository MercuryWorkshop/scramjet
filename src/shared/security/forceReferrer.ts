import {
	type RedirectTracker,
	type ReferrerPolicyData,
	type SiteDirective,
	ScramjetDB,
} from "@/types";
import { openDB, IDBPDatabase } from "idb";

// Persist the redirect trackers for an hour
const TRACKER_EXPIRY = 60 * 60 * 1000;
const SITE_HIERARCHY: Record<SiteDirective, number> = {
	none: 0,
	"same-origin": 1,
	"same-site": 2,
	"cross-site": 3,
};

/**
 * Gets a connection to the IndexedDB database
 *
 * @returns Promise that resolves to the database connection
 */
async function getDB(): Promise<IDBPDatabase<ScramjetDB>> {
	return openDB<ScramjetDB>("$scramjet", 1);
}

/**
 * Retrieves a redirect tracker for a given URL
 *
 * @param url The URL to look up
 * @returns Redirect tracker if found, or `null`
 */
async function getTracker(url: string): Promise<RedirectTracker | null> {
	const db = await getDB();
	return (await db.get("redirectTrackers", url)) || null;
}

/**
 * Store or update a redirect tracker for a given URL
 *
 * @param url URL to store the tracker for
 * @param tracker Redirect tracker data to store
 */
async function setTracker(
	url: string,
	tracker: RedirectTracker
): Promise<void> {
	const db = await getDB();
	await db.put("redirectTrackers", tracker, url);
}

/**
 * Delete a redirect tracker for a given URL
 *
 * @param url URL whose tracker should be deleted
 */
async function deleteTracker(url: string): Promise<void> {
	const db = await getDB();
	await db.delete("redirectTrackers", url);
}

/**
 * Initialize tracking for a new request that might redirect
 *
 * @param requestUrl URL of the request being made
 * @param referrer Referrer URL of the request, or `null`
 * @param initialSite Initial Sec-Fetch-Site directive
 */
export async function initializeTracker(
	requestUrl: string,
	referrer: string | null,
	initialSite: string
): Promise<void> {
	const existing = await getTracker(requestUrl);
	if (existing) {
		return;
	}

	await setTracker(requestUrl, {
		originalReferrer: referrer || "",
		mostRestrictiveSite: initialSite as SiteDirective,
		referrerPolicy: "",
		chainStarted: Date.now(),
	});
}

/**
 * Update tracker when a redirect is encountered
 *
 * @param originalUrl URL that is redirecting
 * @param redirectUrl URL being redirected to
 * @param newReferrerPolicy Referrer Policy from the redirect response
 */
export async function updateTracker(
	originalUrl: string,
	redirectUrl: string,
	newReferrerPolicy?: string
): Promise<void> {
	const tracker = await getTracker(originalUrl);
	if (!tracker) return;

	await deleteTracker(originalUrl);
	if (newReferrerPolicy) {
		tracker.referrerPolicy = newReferrerPolicy;
	}
	await setTracker(redirectUrl, tracker);
}

/**
 * Get most restrictive site value for a request
 *
 * @param requestUrl The URL of the current request
 * @param currentSite The current `Sec-Fetch-Site` directive for this request
 * @returns Most restrictive `Sec-Fetch-Site` directive from the redirect chain
 */
export async function getMostRestrictiveSite(
	requestUrl: string,
	currentSite: string
): Promise<string> {
	const tracker = await getTracker(requestUrl);
	if (!tracker) return currentSite;

	const trackedValue = SITE_HIERARCHY[tracker.mostRestrictiveSite];
	const currentValue = SITE_HIERARCHY[currentSite as SiteDirective] ?? 0;

	if (currentValue > trackedValue) {
		tracker.mostRestrictiveSite = currentSite as SiteDirective;
		await setTracker(requestUrl, tracker);

		return currentSite;
	}

	return tracker.mostRestrictiveSite;
}

/**
 * Clean up tracker after request completes
 * @param requestUrl URL of the completed request
 */
export async function cleanTracker(requestUrl: string): Promise<void> {
	await deleteTracker(requestUrl);
}

/**
 * Clean up expired trackers
 */
export async function cleanExpiredTrackers(): Promise<void> {
	const now = Date.now();
	const db = await getDB();
	const tx = db.transaction("redirectTrackers", "readwrite");

	for await (const cursor of tx.store) {
		const tracker = cursor.value as RedirectTracker;
		if (now - tracker.chainStarted > TRACKER_EXPIRY) {
			cursor.delete();
		}
	}

	await tx.done;
}

/**
 * Store referrer policy for a URL
 *
 * @param url URL to store the policy for
 * @param policy Referrer policy to store
 * @param referrer The referrer URL that set this policy
 */
export async function storeReferrerPolicy(
	url: string,
	policy: string,
	referrer: string
): Promise<void> {
	const db = await getDB();
	const data: ReferrerPolicyData = { policy, referrer };
	await db.put("referrerPolicies", data, url);
}

/**
 * Get referrer policy data for a URL
 *
 * @param url URL to get the policy for
 * @returns Referrer policy data if found, or `null`
 */
export async function getReferrerPolicy(
	url: string
): Promise<ReferrerPolicyData | null> {
	const db = await getDB();
	return (await db.get("referrerPolicies", url)) || null;
}
