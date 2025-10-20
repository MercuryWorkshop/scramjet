addEventListener(
	"message",
	({
		data: {
			sab,
			args: [method, url, _, username, password],
			body,
			headers,
		},
	}) => {
		const view = new DataView(sab);
		const u8view = new Uint8Array(sab);

		const xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";

		// force async since we need it to resolve to the sw
		xhr.open(method, url, true, username, password);

		if (headers)
			for (const [k, v] of Object.entries(headers)) {
				xhr.setRequestHeader(k, v as string);
			}

		xhr.send(body);

		xhr.onload = () => {
			let cursor = 1; // first byte is the lock

			view.setUint16(cursor, xhr.status);
			cursor += 2;

			// next write the header string
			const headers = xhr.getAllResponseHeaders();
			view.setUint32(cursor, headers.length);
			cursor += 4;

			if (sab.byteLength < cursor + headers.length)
				sab.grow(cursor + headers.length);
			u8view.set(new TextEncoder().encode(headers), cursor);
			cursor += headers.length;

			view.setUint32(cursor, xhr.response.byteLength);
			cursor += 4;

			if (sab.byteLength < cursor + xhr.response.byteLength)
				sab.grow(cursor + xhr.response.byteLength);
			u8view.set(new Uint8Array(xhr.response), cursor);

			// release the lock, main thread will stop spinning now
			view.setUint8(0, 1);
		};
		xhr.ontimeout =
			xhr.onerror =
			xhr.onabort =
				() => {
					console.error("xhr failed");
					view.setUint8(0, 1);
				};
	}
);
