import { ScramjetClient } from "./client";

export class SingletonBox {
	clients: ScramjetClient[] = [];
	globals: Map<Self, ScramjetClient> = new Map();
	documents: Map<Document, ScramjetClient> = new Map();
	locations: Map<Location, ScramjetClient> = new Map();

	constructor(public ownerclient: ScramjetClient) {}

	registerClient(client: ScramjetClient, global: Self) {
		this.clients.push(client);
		this.globals.set(global, client);
		this.documents.set(global.document, client);
		this.locations.set(global.location, client);
	}
}
