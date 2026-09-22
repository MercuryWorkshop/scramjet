import { basicTest, serverTest } from "../../testcommon.ts";

/* eslint-disable quotes -- browser snippets are clearer as template literals */

// OPFS is per-origin storage, and under a proxy every site shares the proxy's
// one origin. Scramjet hands each site a subdirectory of the real root instead,
// which has to be indistinguishable from the root itself:
//
//  - its `name` is `""`, and `name` is a *prototype* getter, so the stand-in
//    cannot carry an own `name` without becoming detectable
//  - the directory it picks has to be injective in the origin, or two sites
//    share a tree
//
// The handle is also structured-cloneable, so which realm reads `name` off it
// need not be the realm that asked for it.

const differential = (name: string, js: string) =>
	basicTest({
		name: `opfs-${name}`,
		js: `
			const snapshot = async () => {
				try {
					return { value: await (${js}) };
				} catch (error) {
					return { error: error && error.name, message: error && error.message };
				}
			};
			assertConsistent(${JSON.stringify(name)}, await snapshot());
		`,
	});

// --- the handle can outlive the realm that asked for it ---------------------

const crossRealm = serverTest({
	name: "opfs-scoped-root-name-across-realms",
	autoPass: true,
	js: `
		const load = (f) => new Promise((r) => { f.onload = r; setTimeout(r, 4000); });
		const f = document.createElement("iframe");
		f.src = "/frame.html";
		document.body.appendChild(f);
		await load(f);

		// asked for in the frame's realm...
		const root = await f.contentWindow.navigator.storage.getDirectory();
		assertEqual(root.name, "", "read back in the frame's own realm");

		// ...and read through this realm's getter, which is a different client
		const outerGetter = Object.getOwnPropertyDescriptor(FileSystemHandle.prototype, "name").get;
		assertEqual(outerGetter.call(root), "", "read through the parent realm's getter");

		// and the reverse direction
		const ours = await navigator.storage.getDirectory();
		const innerGetter = Object.getOwnPropertyDescriptor(
			f.contentWindow.FileSystemHandle.prototype, "name"
		).get;
		assertEqual(innerGetter.call(ours), "", "our root read through the frame's getter");
	`,
	start: async (server) => {
		server.on("request", (req, res) => {
			if (res.headersSent) return;
			const path = (req.url || "/").split("?")[0];
			if (path === "/" || path === "/script.js") return;
			if (path === "/frame.html") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end("<!DOCTYPE html><html><body>frame</body></html>");

				return;
			}
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("nf");
		});
	},
});

export default [
	// --- the stand-in root has to look like a root --------------------------

	differential(
		"root-name",
		`navigator.storage.getDirectory().then((r) => r.name)`
	),

	differential(
		"root-name-is-not-an-own-property",
		`navigator.storage.getDirectory().then((r) =>
			Object.getOwnPropertyDescriptor(r, "name") === null ||
			Object.getOwnPropertyDescriptor(r, "name") === undefined
		)`
	),

	differential(
		"root-name-comes-off-the-prototype",
		`navigator.storage.getDirectory().then((r) => {
			// deleting an own data property would expose it; there is nothing to delete
			const before = r.name;
			delete r.name;
			return before + "|" + r.name + "|" + Object.keys(r).length;
		})`
	),

	differential(
		"root-kind-and-prototype",
		`navigator.storage.getDirectory().then((r) =>
			r.kind + "|" +
			(Object.getPrototypeOf(r) === FileSystemDirectoryHandle.prototype) + "|" +
			(r instanceof FileSystemHandle)
		)`
	),

	// --- a name getter still has to reject a forgery ------------------------

	differential(
		"name-getter-brand-checks",
		`Promise.resolve().then(() => {
			const fake = Object.create(FileSystemHandle.prototype);
			try {
				fake.name;
				return "no throw";
			} catch (e) {
				return e.constructor.name;
			}
		})`
	),

	// --- the scoped directory has to be stable and usable -------------------

	basicTest({
		name: "opfs-round-trip-persists-across-calls",
		js: `
			const a = await navigator.storage.getDirectory();
			const fh = await a.getFileHandle("probe.txt", { create: true });
			const w = await fh.createWritable();
			await w.write("stored");
			await w.close();

			// a second getDirectory() has to land in the same tree, or the scope
			// name is not a stable function of the origin
			const b = await navigator.storage.getDirectory();
			const again = await b.getFileHandle("probe.txt");
			assertEqual(await (await again.getFile()).text(), "stored", "the file survives a second getDirectory()");

			const names = [];
			for await (const key of b.keys()) names.push(key);
			assertEqual(names.join(","), "probe.txt", "the scoped root lists only this site's entries");

			await b.removeEntry("probe.txt");
		`,
	}),

	basicTest({
		name: "opfs-resolve-treats-the-scoped-root-as-the-root",
		js: `
			const root = await navigator.storage.getDirectory();
			const dir = await root.getDirectoryHandle("sub", { create: true });
			const fh = await dir.getFileHandle("f.txt", { create: true });
			try {
				assertEqual((await root.resolve(fh)).join("/"), "sub/f.txt", "resolve is relative to the stand-in root");
				assertEqual((await root.resolve(root)).length, 0, "the root resolves to itself as an empty path");
			} finally {
				await root.removeEntry("sub", { recursive: true });
			}
		`,
	}),

	crossRealm,
];
