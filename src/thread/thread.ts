import { rewriteJs } from "../shared/rewriters/js";

// @ts-ignore
onconnect = (ev) => {
	const port = ev.ports[0];

	console.log("thread: connected to port", port);
	port.postMessage("ready");

	let syncToken = 0;
	port.onmessage = ({ data }) => {
		console.log("thread: received message", data);
		const [task, ...args] = data;
		const token = syncToken++;

		try {
			const res = tasks[task](...args);
			console.log("thread: task", task, "completed with token", token);
			port.postMessage({
				token,
				result: res,
			});
		} catch (err) {
			port.postMessage({
				token,
				error: err.message,
			});
		}

		port.postMessage("idle");
	};
};

const tasks = {
	rewriteJs: taskRewriteJs,
};

function taskRewriteJs(js: ArrayBuffer, origin: string): string {
	// idk how to get the codec from here
	return rewriteJs(js, new URL(origin), () => {});
}
