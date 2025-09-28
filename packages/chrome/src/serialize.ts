type SerializedBrowserData = {
	localStorage: Record<string, string>;
	indexedDB: SerializedIndexedDB[];
};

type SerializedIndexedDB = {
	name: string;
	version: number;
	stores: SerializedObjectStore[];
};

type SerializedObjectStore = {
	name: string;
	keyPath: any;
	autoIncrement: boolean;
	pairs: Array<[IDBValidKey, string]>; // [key, stringified_value]
};

async function serializeObjectStore(
	store: IDBObjectStore
): Promise<SerializedObjectStore> {
	const ser: SerializedObjectStore = {
		name: store.name,
		keyPath: store.keyPath,
		autoIncrement: store.autoIncrement,
		pairs: [],
	};

	// Get all records from the store
	return new Promise<SerializedObjectStore>((resolveStore, rejectStore) => {
		const request = store.openCursor();

		request.onerror = () =>
			rejectStore(new Error(`Failed to open cursor for ${store.name}`));

		request.onsuccess = function cursorIteration(_event) {
			const cursor = request.result;

			if (cursor) {
				// Add current record to the pairs array
				ser.pairs.push([cursor.key, JSON.stringify(cursor.value)]);

				// Move to the next record
				cursor.continue();
			} else {
				// No more records, resolve with the serialized store
				resolveStore(ser);
			}
		};
	});
}

async function serializeDb(name: string): Promise<SerializedIndexedDB> {
	return new Promise<SerializedIndexedDB>((resolve, reject) => {
		const req = indexedDB.open(name);

		req.onerror = () => reject(new Error(`Failed to open database ${name}`));

		req.onsuccess = async () => {
			const db = req.result;

			try {
				const storeNames = Array.from(db.objectStoreNames);

				if (storeNames.length === 0) {
					resolve({
						name: db.name,
						version: db.version,
						stores: [],
					});
					db.close();

					return;
				}

				const trans = db.transaction(storeNames, "readonly");
				const storePromises = storeNames.map((name) =>
					serializeObjectStore(trans.objectStore(name))
				);

				const stores = await Promise.all(storePromises);

				resolve({
					name: db.name,
					version: db.version,
					stores,
				});
			} catch (error) {
				reject(error);
			} finally {
				db.close();
			}
		};
	});
}

type SerializedOPFSFile = {
	kind: "file";
	name: string;
	data: Uint8Array;
};

type SerializedOFPSDirectory = {
	kind: "directory";
	name: string;
	files: SerializedOPFSHandle[];
};

type SerializedOPFSHandle = SerializedOPFSFile | SerializedOFPSDirectory;

export async function serializeAll(): Promise<SerializedBrowserData> {
	// Serialize localStorage
	const localStorage: Record<string, string> = {};
	for (const key in window.localStorage) {
		// Skip internal keys
		if (key === "browserstate" || key.startsWith("puter")) continue;

		// Only include actual localStorage items, not methods
		if (Object.prototype.hasOwnProperty.call(window.localStorage, key)) {
			localStorage[key] = window.localStorage[key];
		}
	}

	// Serialize IndexedDB databases
	const databases = await window.indexedDB.databases();
	const dbPromises = databases
		.filter((dbInfo) => dbInfo.name) // Filter out any databases without names
		.map((dbInfo) => serializeDb(dbInfo.name!));

	const indexedDBData = await Promise.all(dbPromises);

	return {
		localStorage,
		indexedDB: indexedDBData,
	};
}

export async function deserializeAll(
	data: SerializedBrowserData
): Promise<void> {
	// Restore localStorage
	for (const [key, value] of Object.entries(data.localStorage)) {
		window.localStorage.setItem(key, value);
	}

	for (const db of data.indexedDB) {
		await deserializeDb(db);
	}

	console.log("Browser data successfully restored");
}

async function deserializeDb(db: SerializedIndexedDB): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const request = indexedDB.open(db.name, db.version);

		// Handle database upgrades/creation
		request.onupgradeneeded = (_event) => {
			const database = request.result;

			// Create object stores
			for (const store of db.stores) {
				if (!database.objectStoreNames.contains(store.name)) {
					database.createObjectStore(store.name, {
						keyPath: store.keyPath,
						autoIncrement: store.autoIncrement,
					});
				}
			}
		};

		request.onerror = () =>
			reject(new Error(`Failed to open database ${db.name}`));

		request.onsuccess = async () => {
			const database = request.result;

			try {
				for (const store of db.stores) {
					if (store.pairs.length === 0) continue;

					const transaction = database.transaction(store.name, "readwrite");
					const objectStore = transaction.objectStore(store.name);

					const addPromises = store.pairs.map(async ([key, valueStr]) => {
						try {
							const value = JSON.parse(valueStr);
							if (store.autoIncrement) {
								objectStore.put(value);
							} else {
								objectStore.put(value, key);
							}
						} catch (e) {
							console.error(
								`Failed to parse value for key ${String(key)} in store ${store.name}:`,
								e
							);
						}
					});

					await Promise.all(addPromises);

					// Wait for transaction to complete
					await new Promise<void>((resolveTransaction, rejectTransaction) => {
						transaction.oncomplete = () => resolveTransaction();
						transaction.onerror = () =>
							rejectTransaction(
								new Error(`Transaction failed for ${store.name}`)
							);
					});
				}

				resolve();
			} catch (error) {
				reject(error);
			} finally {
				database.close();
			}
		};
	});
}
