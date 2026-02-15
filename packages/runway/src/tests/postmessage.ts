import { basicTest, multiFrameTest } from "../testcommon.ts";

export default [
	basicTest({
		name: "postmessage-fake-target-sanity",
		js: `
            const messages = [];
            const fakeTarget = {
                postMessage: (msg) => messages.push(msg)
            };
            fakeTarget.postMessage("test");
            assertEqual(messages.length, 1, "postMessage should be called");
            assertEqual(messages[0], "test", "message should be correct");
        `,
	}),
	basicTest({
		name: "postmessage-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.data, "test", "message should be correct");
                pass();
            });
            postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-event-meta-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.isTrusted, true, "isTrusted should be true");
                assertEqual(event.source, window, "source should be correct");
                assertEqual(event.origin, location.origin, "origin should be correct");
                pass();
            });
            postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-self-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.data, "test", "message should be correct");
                pass();
            });
            self.postMessage("test");
        `,
		autoPass: false,
	}),
	basicTest({
		name: "postmessage-self-event-meta-sanity",
		js: `
            addEventListener("message", (event) => {
                assertEqual(event.isTrusted, true, "isTrusted should be true");
                assertEqual(event.source, window, "source should be correct");
                assertEqual(event.origin, location.origin, "origin should be correct");
                pass();
            });
            self.postMessage("test");
        `,
		autoPass: false,
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity",
		root: {
			js: () => `
                addEventListener("message", (event) => {
                    assertEqual(event.data, "test", "message should be correct");
                    pass();
                });
            `,
			subframes: [
				{
					id: "child",
					js: () => `
                        parent.postMessage("test");
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-reverse",
		root: {
			js: () => `
                window.onload = () => {
                    frames[0].postMessage("test-reverse");
                };
            `,
			subframes: [
				{
					id: "child",
					js: () => `
                    addEventListener("message", (event) => {
                        assertEqual(event.data, "test-reverse", "message should be correct");
                        pass();
                    });
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-cross",
		root: {
			js: () => `
                addEventListener("message", (event) => {
                    assertEqual(event.data, "test", "message should be correct");
                    pass();
                });
            `,
			subframes: [
				{
					originid: "cross",
					id: "child",
					js: () => `
                        parent.postMessage("test");
                    `,
				},
			],
		},
	}),
	multiFrameTest({
		name: "postmessage-multi-frame-sanity-reverse-cross",
		root: {
			js: () => `
                window.onload = () => {
                    frames[0].postMessage("test-reverse");
                };
            `,
			subframes: [
				{
					originid: "cross",
					id: "child",
					js: () => `
                        addEventListener("message", (event) => {
                            assertEqual(event.data, "test-reverse", "message should be correct");
                            pass();
                        });
                    `,
				},
			],
		},
	}),
];
