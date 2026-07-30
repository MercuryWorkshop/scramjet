import { basicTest } from "../../testcommon.ts";

// Storage is namespaced per proxied origin, so the keys a page writes are not
// the keys the backing store holds. Every enumeration route has to un-namespace
// consistently: getItem, length, key(i), Object.keys, for-in and direct
// property access.
//
// Tests get a fresh port but the OS may hand the same port to a later test, so
// the store is not guaranteed empty - and clear() cannot be used to reset it
// (see storage-clear). Each test therefore works under its own key prefix and
// measures length as a delta.

const storageTest = (name: string, prefix: string, body: string) =>
	basicTest({
		name,
		js: `
			const P = ${JSON.stringify(prefix)};
			const base = localStorage.length;
			const mine = () => Object.keys(localStorage).filter((k) => k.startsWith(P)).sort();
			const grew = () => localStorage.length - base;
			try {
				${body}
			} finally {
				for (const k of mine()) localStorage.removeItem(k);
			}
		`,
	});

export default [
	storageTest(
		"storage-getitem-setitem",
		"sg:",
		`
			localStorage.setItem(P + "alpha", "1");
			localStorage.setItem(P + "beta", "2");
			assertEqual(localStorage.getItem(P + "alpha"), "1", "getItem");
			assertEqual(localStorage.getItem(P + "nope"), null, "a missing key is null");
			assertEqual(grew(), 2, "length grew by two");
			localStorage.setItem(P + "alpha", "overwritten");
			assertEqual(localStorage.getItem(P + "alpha"), "overwritten", "overwrite");
			assertEqual(grew(), 2, "length unchanged by an overwrite");
			localStorage.removeItem(P + "alpha");
			assertEqual(localStorage.getItem(P + "alpha"), null, "removeItem");
			assertEqual(grew(), 1, "length after removeItem");
		`
	),
	storageTest(
		"storage-object-keys",
		"sk:",
		`
			localStorage.setItem(P + "alpha", "1");
			localStorage.setItem(P + "beta", "2");
			assertDeepEqual(mine(), [P + "alpha", P + "beta"], "Object.keys");
			assertDeepEqual(
				Object.getOwnPropertyNames(localStorage).filter((k) => k.startsWith(P)).sort(),
				[P + "alpha", P + "beta"],
				"getOwnPropertyNames"
			);
			assertDeepEqual(
				Object.entries(localStorage).filter(([k]) => k.startsWith(P)).sort(),
				[[P + "alpha", "1"], [P + "beta", "2"]],
				"Object.entries"
			);
			const parsed = JSON.parse(JSON.stringify(localStorage));
			assertEqual(parsed[P + "alpha"], "1", "JSON.stringify");
		`
	),
	storageTest(
		"storage-for-in",
		"sf:",
		`
			localStorage.setItem(P + "alpha", "1");
			const seen = [];
			for (const k in localStorage) seen.push(k);
			assert(seen.includes(P + "alpha"), "for-in must yield the page's key, got " + JSON.stringify(seen));
			assert(!seen.some((k) => k.includes("scramjet")),
				"for-in must not leak namespaced keys, got " + JSON.stringify(seen));
		`
	),
	storageTest(
		"storage-property-access",
		"sp:",
		`
			localStorage[P + "gamma"] = "3";
			assertEqual(localStorage[P + "gamma"], "3", "property write then read");
			assertEqual(localStorage.getItem(P + "gamma"), "3", "visible through getItem");
			assertEqual(grew(), 1, "length grew");
			assert((P + "gamma") in localStorage, "in operator");
			localStorage.setItem(P + "delta", "4");
			assertEqual(localStorage[P + "delta"], "4", "setItem is visible as a property");
		`
	),
	storageTest(
		"storage-coercion-and-brand",
		"sc:",
		`
			localStorage.setItem(P + "n", 5);
			assertEqual(localStorage.getItem(P + "n"), "5", "values are stringified");
			localStorage.setItem(P + "o", { a: 1 });
			assertEqual(localStorage.getItem(P + "o"), "[object Object]", "objects are stringified");
			assertEqual(Object.prototype.toString.call(localStorage), "[object Storage]", "brand");
			assert(localStorage instanceof Storage, "instanceof Storage");
			assertEqual(localStorage, window.localStorage, "stable identity");
			assertEqual(typeof localStorage.setItem, "function", "setItem is a function");
			assertEqual(typeof localStorage.key, "function", "key is a function");
		`
	),
	storageTest(
		"storage-session-isolation",
		"si:",
		`
			const sessionBase = sessionStorage.length;
			try {
				sessionStorage.setItem(P + "s", "1");
				localStorage.setItem(P + "l", "2");
				assert(Object.keys(sessionStorage).includes(P + "s"), "sessionStorage sees its own key");
				assert(mine().includes(P + "l"), "localStorage sees its own key");
				assertEqual(localStorage.getItem(P + "s"), null, "the two stores are separate");
				assertEqual(sessionStorage.getItem(P + "l"), null, "and in the other direction");
				assertEqual(sessionStorage.length - sessionBase, 1, "sessionStorage length");
			} finally {
				sessionStorage.removeItem(P + "s");
			}
		`
	),
	storageTest(
		"storage-json-payload",
		"sj:",
		`
			const payload = { user: "x", nested: { list: [1, 2, 3] } };
			localStorage.setItem(P + "state", JSON.stringify(payload));
			assertDeepEqual(JSON.parse(localStorage.getItem(P + "state")), payload, "JSON payload round trip");
			localStorage.setItem(P + "weird:key/with.chars", "v");
			assertEqual(localStorage.getItem(P + "weird:key/with.chars"), "v", "punctuation in keys");
			assert(mine().includes(P + "weird:key/with.chars"), "and it enumerates");
		`
	),

	// ------------------------------------------------------------------
	storageTest(
		// KNOWN FAILURE: key(i) returns the stored *value* instead of the key.
		// `for (let i = 0; i < localStorage.length; i++) localStorage.key(i)` is
		// the canonical way to enumerate storage.
		"storage-key-by-index",
		"si2:",
		`
			localStorage.setItem(P + "alpha", "avalue");
			localStorage.setItem(P + "beta", "bvalue");
			const keys = [];
			for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
			assert(keys.includes(P + "alpha"), "key(i) must return keys, got " + JSON.stringify(keys));
			assert(keys.includes(P + "beta"), "key(i) must return every key");
			assertEqual(localStorage.key(localStorage.length + 50), null, "an out-of-range index is null");
		`
	),
	storageTest(
		// KNOWN FAILURE: `delete storage.foo` does not remove the entry.
		"storage-delete-property",
		"sd:",
		`
			localStorage[P + "gamma"] = "3";
			assertEqual(delete localStorage[P + "gamma"], true, "delete reports success");
			assertEqual(localStorage.getItem(P + "gamma"), null, "delete must remove the entry");
			assertEqual(grew(), 0, "length back to where it started");
		`
	),
	basicTest({
		// KNOWN FAILURE: clear() is a no-op - length, getItem, key(i) and
		// Object.keys all still report every entry afterwards. Logout and
		// "reset my settings" flows depend on it.
		name: "storage-clear",
		js: `
			localStorage.setItem("clear-a", "1");
			localStorage.setItem("clear-b", "2");
			assert(localStorage.length >= 2, "precondition");
			localStorage.clear();
			assertEqual(localStorage.length, 0, "length after clear");
			assertEqual(localStorage.getItem("clear-a"), null, "getItem after clear");
			assertDeepEqual(Object.keys(localStorage), [], "keys after clear");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: a missing key read as a property yields null instead of
		// undefined, so `storage.foo === undefined` and `typeof storage.foo`
		// checks take the wrong branch.
		name: "storage-missing-property-is-undefined",
		js: `
			assertEqual(localStorage["definitely-absent-key"], undefined, "a missing property is undefined");
			assertEqual(localStorage.getItem("definitely-absent-key"), null, "but getItem still reports null");
		`,
	}),
	basicTest({
		name: "storage-event-not-in-writing-document",
		js: `
			// per spec the document that performs the write does not receive the event
			let fired = false;
			window.addEventListener("storage", () => { fired = true; });
			localStorage.setItem("sf", "1");
			await new Promise((r) => setTimeout(r, 500));
			assertEqual(fired, false, "the writing document must not get its own storage event");
			localStorage.removeItem("sf");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: no storage event is delivered to other same-origin
		// documents at all. Tabs and frames use it to stay in sync - propagating
		// a logout, an auth-token refresh, a theme change - and none of that fires.
		name: "storage-event-child-frame",
		js: `
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await new Promise((r) => setTimeout(r, 200));
			const ev = await new Promise((resolve) => {
				f.contentWindow.addEventListener("storage", resolve);
				localStorage.setItem("cf", "cfvalue");
				setTimeout(() => resolve(null), 2000);
			});
			assert(ev, "a same-origin child frame must receive the storage event");
			assertEqual(ev.key, "cf", "event.key");
			assertEqual(ev.newValue, "cfvalue", "event.newValue");
			assert(!(ev.url || "").includes("/~/sj/"), "event.url must not expose the proxy URL: " + ev.url);
			localStorage.removeItem("cf");
		`,
	}),
	basicTest({
		// KNOWN FAILURE: same in the other direction.
		name: "storage-event-parent-listens",
		js: `
			const f = document.createElement("iframe");
			document.body.appendChild(f);
			await new Promise((r) => setTimeout(r, 200));
			const ev = await new Promise((resolve) => {
				window.addEventListener("storage", resolve, { once: true });
				f.contentWindow.localStorage.setItem("pw", "pwvalue");
				setTimeout(() => resolve(null), 2000);
			});
			assert(ev, "the parent must receive an event for a child frame's write");
			assertEqual(ev.key, "pw", "event.key");
			localStorage.removeItem("pw");
		`,
	}),
];
