export function memoize<T extends HTMLElement>(
	fn: () => T,
	key: any,
	cache: Record<string, T>
): T {
	if (cache[key]) {
		return cache[key];
	}
	const element = fn();
	cache[key] = element;

	return element;
}
