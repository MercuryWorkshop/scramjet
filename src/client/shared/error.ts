import { decodeUrl } from "../../shared";
import { ScramjetClient } from "../client";

export const enabled = () => self.$scramjet.config.flags.cleanerrors;
export default function (client: ScramjetClient, self: Self) {
	// v8 only. all we need to do is clean the scramjet urls from stack traces
	Error.prepareStackTrace = (error, stack) => {
		let newstack = error.stack;

		for (let i = 0; i < stack.length; i++) {
			const url = stack[i].getFileName();
			try {
				newstack = newstack.replaceAll(url, decodeUrl(url));
			} catch {}
		}

		return newstack;
	};
}
