import type { ScramjetClient } from "@client/index";
import { initializeCsp } from "@client/csp";

export const order = -100;
export default function (client: ScramjetClient) {
	initializeCsp(client);
}
