import { ScramjetClient } from "./client";
import { SourceMaps } from "./shared/sourcemaps";

export class SingletonBox {
	clients: ScramjetClient[] = [];
	globals: Map<Self, ScramjetClient> = new Map();
	documents: Map<Document, ScramjetClient> = new Map();
	locations: Map<Location, ScramjetClient> = new Map();

	ctors: Record<string, Function[]> = {};

	sourcemaps: SourceMaps = {};

	constructor(public ownerclient: ScramjetClient) {}

	registerClient(client: ScramjetClient, global: Self) {
		this.clients.push(client);
		this.globals.set(global, client);
		this.documents.set(global.document, client);
		this.locations.set(global.location, client);

		Object.getOwnPropertyNames(global).forEach((prop) => {
			const desc = Object.getOwnPropertyDescriptor(global, prop);
			if (desc && typeof desc.value === "function") {
				if (!this.ctors[prop]) this.ctors[prop] = [];
				this.ctors[prop].push(desc.value);
			}
		});
	}

	instanceof(obj: any, name: string) {
		const ctors = this.ctors[name];
		if (!ctors) throw new Error(`No constructors for ${name} found`);
		for (const ctor of ctors) {
			if (obj instanceof ctor) return true;
		}
		return false;
	}
}
