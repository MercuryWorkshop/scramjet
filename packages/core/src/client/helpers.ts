export function getOwnPropertyDescriptorHandler(target, prop) {
	const realDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);

	return realDescriptor;
}
