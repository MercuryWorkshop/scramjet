import type { Stateful } from "dreamland/core";

export class StatefulClass {
	constructor(state: Stateful<any>) {
		return state;
	}
}
