import { basicTest } from "../../testcommon.ts";

export default [
	// A request that cannot be made produces no response at all: the fetch
	// rejects with a network error. A status would say the server answered.
	basicTest({
		name: "controller-unreachable-host-is-a-network-error",
		js: `
			let outcome;
			try {
				const response = await fetch("http://unreachable.invalid/");
				outcome = "resolved with " + response.status;
			} catch (e) {
				outcome = e;
			}
			assert(outcome instanceof TypeError, "expected a TypeError, got " + outcome);
		`,
	}),
];
