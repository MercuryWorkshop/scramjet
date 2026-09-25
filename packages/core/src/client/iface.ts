/**
 * A postprocessor will rewrite Intercept(class extends X) to Intercept(class extends iface("X")) so that the interface name cannot be tampered with
 */
import { Object_defineProperty, Symbol_for } from "@/shared/snapshot";

export const IFACE_NAME = Symbol_for("scramjet interface name");

export function iface(name: string): any {
	const base = class {};
	// `.name` for stack purposes
	Object_defineProperty(base, "name", { value: name });
	Object_defineProperty(base, IFACE_NAME, { value: name });

	return base;
}
