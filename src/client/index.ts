// entrypoint for scramjet.client.js

import { ScramjetClient } from "./client";

dbg.log("scrammin");
// if it already exists, that means the handlers have probably already been setup by the parent document
if (!(ScramjetClient.SCRAMJET in self)) {
	const client = new ScramjetClient(self);
	client.hook();
}
