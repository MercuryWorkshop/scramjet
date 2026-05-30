import { basicTest } from "../../testcommon.ts";

// Ported from data4/payload2_lifted.js:12538-12898.
//
// The lifted chain walks MessageEvent.prototype descriptors for data, origin,
// and source, reads each getter, and fingerprints getter source strings such as
// "get origin" / "get source". The same cluster then continues into MouseEvent
// descriptor checks; this file keeps the MessageEvent-specific part focused so
// postMessage rewrites show up separately from generic event descriptors.

export default basicTest({
	name: "cf-message-event-descriptors",
	js: `
		const describeDescriptor = (proto, prop) => {
			const desc = Object.getOwnPropertyDescriptor(proto, prop);
			if (!desc) return null;

			const getter = desc.get;
			const value = desc.value;
			return {
				configurable: desc.configurable,
				enumerable: desc.enumerable,
				hasGetter: typeof getter === "function",
				getterName: typeof getter === "function" ? getter.name : null,
				getterString: typeof getter === "function" ? Function.prototype.toString.call(getter) : null,
				hasValue: "value" in desc,
				valueType: typeof value,
				valueName: typeof value === "function" ? value.name : null,
				valueString: typeof value === "function" ? Function.prototype.toString.call(value) : null,
			};
		};

		assert(typeof MessageEvent === "function", "MessageEvent should exist");

		const proto = MessageEvent.prototype;
		const descriptors = {
			data: describeDescriptor(proto, "data"),
			origin: describeDescriptor(proto, "origin"),
			source: describeDescriptor(proto, "source"),
			ports: describeDescriptor(proto, "ports"),
			lastEventId: describeDescriptor(proto, "lastEventId"),
		};

		for (const prop of ["data", "origin", "source"]) {
			const desc = descriptors[prop];
			assert(desc !== null, "MessageEvent.prototype." + prop + " should have a descriptor");
			assert(desc.hasGetter === true, "MessageEvent.prototype." + prop + " should have a getter");
			assert(desc.getterString.indexOf("get " + prop) !== -1,
				"MessageEvent.prototype." + prop + " getter should include native getter name");
		}

		const sample = new MessageEvent("message", {
			data: { HDKQo6: "zMbJz1" },
			origin: "https://challenges.cloudflare.com",
			source: window,
			lastEventId: "cf-event-id",
		});

		const sampleShape = {
			type: sample.type,
			dataKeys: Object.keys(sample.data).sort(),
			origin: sample.origin,
			sourceIsWindow: sample.source === window,
			lastEventId: sample.lastEventId,
			portsLength: sample.ports.length,
			isTrusted: sample.isTrusted,
		};

		assert(sampleShape.origin === "https://challenges.cloudflare.com",
			"constructed MessageEvent should preserve origin");
		assert(sampleShape.sourceIsWindow === true,
			"constructed MessageEvent should preserve source identity");
		assertConsistent("message-event-descriptors", { descriptors, sampleShape });
	`,
});
