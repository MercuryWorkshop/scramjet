import { chromeframe, methods } from ".";
import { Chromebound } from "./types";

let synctoken = 0;
let syncPool: { [token: number]: (val: any) => void } = {};
export function sendChrome<T extends keyof Chromebound>(
	type: T,
	message: Chromebound[T][0]
): Promise<Chromebound[T][1]> {
	let token = synctoken++;

	chromeframe.postMessage(
		{
			$ipc$type: "request",
			$ipc$token: token,
			$ipc$message: {
				type,
				message,
			},
		},
		"*"
	);

	return new Promise((res) => {
		syncPool[token] = res;
	});
}

window.addEventListener("message", (event) => {
	// TODO: this won't work in puter
	if (event.source !== chromeframe) return;
	let data = event.data;
	if (!(data && data.$ipc$type)) return;

	if (data.$ipc$type === "response") {
		let token = data.$ipc$token;
		if (typeof token !== "number") return;
		let cb = syncPool[token];
		if (cb) {
			cb(data.$ipc$message);
			delete syncPool[token];
		}
	} else if (data.$ipc$type === "request") {
		const { type, message } = data.$ipc$message;
		const token = data.$ipc$token;

		methods[type](message).then((response: any) => {
			chromeframe.postMessage(
				{
					$ipc$type: "response",
					$ipc$token: token,
					$ipc$message: response,
				},
				"*"
			);
		});
	}
});
