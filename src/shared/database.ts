import { openDB } from "idb";
import type { ScramjetDB } from "@/types";

export function openScramjetDB() {
	return openDB<ScramjetDB>("$scramjet", 2, {
		upgrade(db) {
			const stores = [
				"config",
				"cookies",
				"redirectTrackers",
				"referrerPolicies",
				"publicSuffixList",
			] as const;
			for (const store of stores) {
				if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
			}
		},
		blocking(_currentVersion, _blockedVersion, event) {
			(event.target as IDBDatabase).close();
		},
	});
}
