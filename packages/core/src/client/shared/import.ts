import { ScramjetClient } from "@client/index";
import {
	type ImportMapState,
	parseImportMaps,
	resolveWithImportMaps,
} from "@rewriters/importmap";
import { Object_defineProperty, Promise_reject, _URL } from "@/shared/snapshot";

export default function (client: ScramjetClient, self: Self) {
	const boundimport = new client.native.window(self).Function(
		"url",
		"return import(url)"
	);

	/**
	 * The import maps the document has registered, as the page wrote them.
	 *
	 * Resolved here rather than left to the browser, because the browser
	 * resolves an `import()` against the *calling script's* URL - and every
	 * dynamic import is called from `boundimport`, a function of scramjet's own,
	 * whose URL no scope the page wrote will ever match.
	 *
	 * Null in a worker, which has no import maps, and in a document with none.
	 */
	const importMaps = (): ImportMapState | null => {
		const document = client.global.document as Document | undefined;
		if (!document) return null;

		const sources = client.text.registeredImportMaps(document);
		if (sources.length === 0) return null;

		return parseImportMaps(sources, client.meta.base);
	};

	Object_defineProperty(self, client.config.globals.importfn, {
		value: function (base: string, url: string) {
			const maps = importMaps();

			let resolved: _URL | null = null;
			if (maps) {
				const match = resolveWithImportMaps(maps, url, base);
				// a null entry, or one that backtracks out of its prefix: the
				// browser refuses those outright
				if (match === "blocked") {
					return Promise_reject(
						client.errors.typeError({
							detail: `Failed to resolve module specifier '${url}'`,
						})
					);
				}
				resolved = match;
			}

			if (
				!resolved &&
				(url.includes(":") ||
					url.startsWith("/") ||
					url.startsWith(".") ||
					url.startsWith(".."))
			) {
				// this is a url
				resolved = new _URL(url, base);
			}

			// a bare specifier no map knows: the native's to refuse
			if (!resolved) return boundimport(url);

			// the map's `integrity` is not enforced - see `rewriters/importmap`
			return boundimport(client.rewriteUrl(resolved.href, { isModule: true }));
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
	Object_defineProperty(self, client.config.globals.metafn, {
		value: function (metaobj: any, base: string) {
			metaobj.url = base;
			metaobj.resolve = function (url: string) {
				return new _URL(url, base).href;
			};

			return metaobj;
		},
		writable: false,
		configurable: false,
		enumerable: false,
	});
}
