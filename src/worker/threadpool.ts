type Thread = {
	handle: MessagePort;
	ready: boolean;
	busy: boolean;
	syncToken: number;
	promises: Map<number, { resolve; reject }>;
};

export class ScramjetThreadpool {
	threads: Thread[] = [];
	constructor() {
		self.addEventListener("message", ({ data }) => {
			if (data.scramjet$type == "add") {
				this.spawn(data.handle);
			}
		});
	}

	spawn(handle) {
		const thread = {
			handle,
			ready: false,
			busy: false,
			syncToken: 0,
			promises: new Map(),
		};

		this.threads.push(thread);

		thread.handle.onmessage = (e) => {
			if (e.data === "ready") {
				thread.ready = true;

				return;
			}
			if (e.data === "idle") {
				thread.busy = false;

				return;
			}

			const { token, result, error } = e.data;
			const { resolve, reject } = thread.promises.get(token);
			thread.promises.delete(token);

			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		};

		thread.handle.start();
	}

	pick(): Thread | undefined {
		const alive = this.threads.filter((t) => t.ready);
		const idle = alive.filter((t) => !t.busy);

		// no threads
		if (!alive.length) return;

		// there is a thread, but it's busy
		if (!idle.length) return alive[Math.floor(Math.random() * alive.length)];

		// there's an open thread
		return idle[Math.floor(Math.random() * idle.length)];
	}

	run(task: string, args: any[], transferrable: any[]): Promise<any> {
		const thread = this.pick();
		if (!thread) throw new Error("No threads available");
		thread.busy = true;

		const token = thread.syncToken++;

		// console.log("runthread: dispatching task", task, "to thread", thread, "of token", token)
		return new Promise((resolve, reject) => {
			thread.promises.set(token, { resolve, reject });

			thread.handle.postMessage([task, ...args], transferrable);
		});
	}

	async rewriteJs(js: ArrayBuffer, origin: string): Promise<string> {
		return await this.run("rewriteJs", [js, origin], [js]);
	}
}
