/**
 * Fallback for browsers that can't transfer a ReadableStream over a MessagePort.
 *
 * Safari doesn't implement transferable streams: putting a ReadableStream in the transfer list
 * throws DataCloneError, the response never reaches the service worker, and nothing loads at all.
 * ArrayBuffer, on the other hand, transfers everywhere — so instead of the stream itself we hand
 * over a MessagePort and pump the body through it chunk by chunk.
 *
 * Backpressure is pull-based on purpose: a chunk is only sent in response to a request from the
 * receiving side. Without that, a fast upstream and a slow consumer fill the message queue, and the
 * symptom is a page that silently stalls halfway through loading.
 *
 * Browsers that can transfer streams never enter this path.
 */

export const CHUNKED_STREAM = "__chunkedStream";

export type ChunkedStream = { [CHUNKED_STREAM]: MessagePort };

let canTransfer: boolean | undefined;

export function canTransferStream(): boolean {
	if (canTransfer === undefined) {
		try {
			const stream = new ReadableStream();
			const { port1 } = new MessageChannel();
			port1.postMessage(stream, [stream as unknown as Transferable]);
			canTransfer = true;
		} catch {
			canTransfer = false;
		}
	}

	return canTransfer;
}

export function isChunkedStream(body: unknown): body is ChunkedStream {
	return (
		typeof body === "object" &&
		body !== null &&
		CHUNKED_STREAM in body &&
		(body as ChunkedStream)[CHUNKED_STREAM] instanceof MessagePort
	);
}

/** Sender side: hands out one chunk per request from the receiver. */
export function chunkedStreamOf(
	stream: ReadableStream<Uint8Array>
): ChunkedStream {
	const { port1, port2 } = new MessageChannel();
	const reader = stream.getReader();

	const finish = (message: Record<string, unknown>) => {
		try {
			port1.postMessage(message);
		} catch {}
		try {
			port1.close();
		} catch {}
	};

	port1.onmessage = async (e: MessageEvent) => {
		if (e.data === "cancel") {
			try {
				await reader.cancel();
			} catch {}
			try {
				port1.close();
			} catch {}

			return;
		}

		try {
			const { value, done } = await reader.read();
			if (done || !value) return finish({ done: true });

			// Only a whole buffer can be transferred. A reader hands out a view that often looks at
			// part of a larger buffer — copy that part out, otherwise neighbouring chunks that
			// haven't been read yet would be detached along with it.
			const exact =
				value.byteOffset === 0 && value.byteLength === value.buffer.byteLength;
			const buffer = exact ? value.buffer : value.slice().buffer;
			port1.postMessage({ chunk: buffer }, [buffer as Transferable]);
		} catch (err) {
			finish({ error: String((err as Error)?.message || err) });
		}
	};
	port1.start();

	return { [CHUNKED_STREAM]: port2 };
}

/** Receiver side: rebuilds the stream, asking for one chunk at a time. */
export function streamOfChunked(port: MessagePort): ReadableStream<Uint8Array> {
	let wake: (() => void) | null = null;
	const nudge = () => {
		const w = wake;
		wake = null;
		if (w) w();
	};

	return new ReadableStream<Uint8Array>({
		start(controller) {
			port.onmessage = (e: MessageEvent) => {
				const data = e.data || {};
				try {
					if (data.chunk) controller.enqueue(new Uint8Array(data.chunk));
					else if (data.done) {
						controller.close();
						port.close();
					} else if (data.error) {
						controller.error(new Error(data.error));
						port.close();
					}
				} catch {}
				nudge();
			};
			port.onmessageerror = () => {
				try {
					controller.error(new Error("chunked stream: messageerror"));
				} catch {}
				nudge();
			};
			port.start();
		},
		pull() {
			return new Promise<void>((resolve) => {
				wake = resolve;
				try {
					port.postMessage("pull");
				} catch {
					nudge();
				}
			});
		},
		cancel() {
			try {
				port.postMessage("cancel");
			} catch {}
			try {
				port.close();
			} catch {}
		},
	});
}
