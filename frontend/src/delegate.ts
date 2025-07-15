export type Delegate<T> = {
	listen: (callback: (value: T) => void) => void;
	(value: T): void;
};

export function createDelegate<T>(): Delegate<T> {
	let listeners: Array<(value: T) => void> = [];

	const delegate = (value: T) => {
		for (const listener of listeners) {
			listener(value);
		}
	};

	delegate.listen = (callback: (value: T) => void) => {
		listeners.push(callback);
	};

	return delegate;
}
