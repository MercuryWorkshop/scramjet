import { expect, test, type Page } from "@playwright/test";
import type { ScramjetController } from "../../../src/controller/controller";

declare const $scramjetLoadController: () => {
	ScramjetController: typeof ScramjetController;
};

const stores = [
	"config",
	"cookies",
	"publicSuffixList",
	"redirectTrackers",
	"referrerPolicies",
];

async function openController(page: Page) {
	return page.evaluate(async () => {
		const { ScramjetController } = $scramjetLoadController();
		const controller = new ScramjetController({
			files: {
				wasm: "/scram/scramjet.wasm.wasm",
				all: "/scram/scramjet.all.js",
				sync: "/scram/scramjet.sync.js",
			},
		});
		const db = await controller.openIDB();

		return {
			version: db.version,
			stores: [...db.objectStoreNames],
			cookie: await db.get("cookies", "cookies"),
		};
	});
}

async function openWorker(page: Page) {
	return page.evaluate(async () => {
		const registration = await navigator.serviceWorker.register("/sw.js", {
			scope: "/scramjet/",
		});
		const worker =
			registration.installing || registration.waiting || registration.active;
		if (worker.state !== "activated") {
			await new Promise<void>((resolve, reject) => {
				const changed = () => {
					if (worker.state === "activated") resolve();
					if (worker.state === "redundant")
						reject(new Error("Worker activation failed"));
				};
				worker.addEventListener("statechange", changed);
				changed();
			});
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open("$scramjet");
			request.onsuccess = () => {
				const db = request.result;
				resolve({ version: db.version, stores: [...db.objectStoreNames] });
				db.close();
			};
			request.onerror = () => reject(request.error);
		});
	});
}

async function seedLegacy(page: Page, withCookies = false) {
	await page.evaluate(
		(withCookies) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open("$scramjet", 1);
				request.onupgradeneeded = () => {
					if (withCookies) request.result.createObjectStore("cookies");
				};
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					if (!withCookies) {
						db.close();
						resolve();

						return;
					}
					const transaction = db.transaction("cookies", "readwrite");
					transaction
						.objectStore("cookies")
						.put({ regression: "preserved" }, "cookies");
					transaction.oncomplete = () => {
						db.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		withCookies
	);
}

test.beforeEach(async ({ page }) => {
	await page.goto("/favicon.webp");
	await page.addScriptTag({ url: "/scram/scramjet.all.js" });
});

test("worker creates the schema before a controller starts", async ({
	page,
}) => {
	expect(await openWorker(page)).toEqual({ version: 2, stores });
	expect((await openController(page)).stores).toEqual(stores);
});

test("worker repairs an empty version 1 database", async ({ page }) => {
	await seedLegacy(page);
	expect(await openWorker(page)).toEqual({ version: 2, stores });
});

test("controller repairs an empty version 1 database", async ({ page }) => {
	await seedLegacy(page);
	expect(await openController(page)).toMatchObject({ version: 2, stores });
});

test("migration preserves data in existing stores", async ({ page }) => {
	await seedLegacy(page, true);
	expect(await openController(page)).toEqual({
		version: 2,
		stores,
		cookie: { regression: "preserved" },
	});
});

test("worker and controller can open the database concurrently", async ({
	page,
}) => {
	const results = await Promise.all([openWorker(page), openController(page)]);
	for (const result of results)
		expect(result).toMatchObject({ version: 2, stores });
});

test("connections close when another client upgrades the database", async ({
	page,
}) => {
	await openController(page);
	const version = await page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = indexedDB.open("$scramjet", 3);
				request.onsuccess = () => {
					const db = request.result;
					resolve(db.version);
					db.close();
				};
				request.onerror = () => reject(request.error);
			})
	);
	expect(version).toBe(3);
});
