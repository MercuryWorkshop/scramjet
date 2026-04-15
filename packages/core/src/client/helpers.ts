import { Object_getOwnPropertyDescriptor } from "@/shared/snapshot";

export function getOwnPropertyDescriptorHandler(target, prop) {
	const realDescriptor = Object_getOwnPropertyDescriptor(target, prop);

	return realDescriptor;
}
