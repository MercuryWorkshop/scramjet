import type { Controller } from "@mercuryworkshop/scramjet-controller";
declare global {
	function initBootstrap(): Promise<Controller>;
}

export * from "./server";
