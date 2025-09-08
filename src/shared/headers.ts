export class ScramjetHeaders {
	headers = {};

	set(key: string, v: string) {
		this.headers[key.toLowerCase()] = v;
	}

	clone(): ScramjetHeaders {
		const newh = new ScramjetHeaders();
		for (const k in this.headers) {
			newh.set(k, this.headers[k]);
		}

		return newh;
	}
}
