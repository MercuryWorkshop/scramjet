import { basicTest } from "../../testcommon.ts";

// Ported from data4/payload2_lifted.js:15838-15912 and 27817-27853.
//
// The lifted code fingerprints Permissions.prototype.query, then queries the
// names from "geolocationAnotificationsAcameraAmicrophone". Permission results
// are origin/context-sensitive, so they are a useful proxy-vs-bare consistency
// surface beyond just checking that navigator.permissions exists.

export default basicTest({
	name: "cf-permissions-query-states",
	js: `
		const describeFn = (fn) => ({
			type: typeof fn,
			name: typeof fn === "function" ? fn.name : null,
			length: typeof fn === "function" ? fn.length : null,
			string: typeof fn === "function" ? Function.prototype.toString.call(fn) : null,
		});

		const queryPermission = async (name) => {
			try {
				const status = await navigator.permissions.query({ name });
				return {
					ok: true,
					state: status.state,
					nameType: typeof status.name,
					onchangeType: typeof status.onchange,
					protoName: Object.getPrototypeOf(status)?.constructor?.name ?? null,
				};
			} catch (e) {
				return { ok: false, errorName: e.name, message: e.message };
			}
		};

		const names = "geolocationAnotificationsAcameraAmicrophone".split("A");
		const snapshot = {
			hasPermissionsCtor: typeof Permissions,
			hasNavigatorPermissions: !!navigator.permissions,
			queryProto: typeof Permissions === "function" ? describeFn(Permissions.prototype.query) : null,
			queryOwnDescriptor: navigator.permissions ? (() => {
				const desc = Object.getOwnPropertyDescriptor(navigator.permissions, "query");
				return desc ? {
					configurable: desc.configurable,
					enumerable: desc.enumerable,
					writable: "writable" in desc ? desc.writable : null,
					value: describeFn(desc.value),
					hasGetter: typeof desc.get === "function",
				} : null;
			})() : null,
			results: {},
		};

		if (navigator.permissions) {
			assert(typeof navigator.permissions.query === "function",
				"navigator.permissions.query should be callable");
			for (const name of names) {
				snapshot.results[name] = await queryPermission(name);
			}
		} else {
			snapshot.results.fallback = await Promise.resolve([]);
		}

		assertConsistent("permissions-query-states", snapshot);
	`,
});
