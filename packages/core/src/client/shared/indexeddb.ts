import { ScramjetClient } from "@client/index";
import { Arguments, Returns, Type } from "@client/webidl";
import {
	String_indexOf,
	String_startsWith,
	String_substring,
	drain,
} from "@/shared/snapshot";

export const enabled = (_client: ScramjetClient, self: Self) =>
	"indexedDB" in self && "IDBFactory" in self && "IDBDatabase" in self;

export default function (client: ScramjetClient) {
	// `scopeOrigin`, not `url.origin`: an about:blank frame's databases are its
	// creator's, and its own URL has no origin to key on
	const scoped = (name: string) => `${client.scopeOrigin}@${name}`;

	client.Intercept(class extends IDBFactory {
		@Returns("IDBOpenDBRequest")
		@Arguments("DOMString", "optional [EnforceRange] unsigned long long")
		open(name: string, version?: number): IDBOpenDBRequest {
			return super.open(scoped(name), version);
		}

		// scoped alongside `open`, or a site cannot delete the database it just
		// created: the unscoped name names nothing and the deletion "succeeds"
		// against a database that never existed
		@Returns("IDBOpenDBRequest")
		@Arguments("DOMString")
		deleteDatabase(name: string): IDBOpenDBRequest {
			return super.deleteDatabase(scoped(name));
		}

		/**
		 * https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
		 *
		 * Every database in the storage key, which every proxied site shares -
		 * so delegating this handed a site the scoped name of every database
		 * every *other* site had ever opened. The origin is the first half of
		 * that string, so it was both a list of the sites the user had visited
		 * and a list of what each one stores, plus scramjet's own
		 * `__scramjet_controller`.
		 *
		 * Scoping `open` bought nothing here, the same way scoping a cache name
		 * bought nothing in `CacheStorage.match`: this member never looks at
		 * the names it is filtering on.
		 */
		@Returns("Promise<sequence<IDBDatabaseInfo>>")
		@Arguments()
		async databases(): Promise<IDBDatabaseInfo[]> {
			const all = await super.databases();
			const prefix = `${client.scopeOrigin}@`;
			const visible: IDBDatabaseInfo[] = [];

			for (const database of drain(all)) {
				const name = database.name;
				// a database with no name is not one of ours and cannot be
				// attributed to this origin
				if (name === undefined || !String_startsWith(name, prefix)) continue;

				visible[visible.length] = {
					name: String_substring(name, prefix.length),
					version: database.version,
				};
			}

			return visible;
		}
	});

	client.Intercept(class extends IDBDatabase {
		@Type("DOMString")
		get name(): string {
			const name = super.name;

			return String_substring(name, String_indexOf(name, "@") + 1);
		}
	});
}
