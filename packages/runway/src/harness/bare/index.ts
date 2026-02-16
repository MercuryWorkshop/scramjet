import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BARE_PORT = 4502;

export async function startBareHarness() {
	const app = express();

	app.use(express.static(path.join(__dirname, "public")));

	app.listen(BARE_PORT, () => {
		console.log(`    Bare harness server listening on port ${BARE_PORT}`);
	});
}
