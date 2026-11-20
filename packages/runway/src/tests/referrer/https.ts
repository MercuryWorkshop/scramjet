import { EXPECT_DOWNGRADE, POLICIES, referrerTest } from "./fixture.ts";

// An https page, and the requests it makes to http: the "strict" policies and
// no-referrer-when-downgrade send nothing on a downgrade. These need hostnames
// the runway transport can pretend are https, so run in scramjet only.

export default [
	referrerTest({
		name: "referrer-https-default-policy",
		https: true,
		js: `
		const same = uid("same"), alt = uid("alt"), xsite = uid("xsite"), down = uid("down");
		await fetch(rurl(MAIN, same));
		await fetch(rurl(ALT, alt));
		await fetch(rurl(XSITE, xsite));
		await fetch(rurl(INSECURE, down));
		await expectRef(same, PAGE, "same-origin");
		await expectRef(alt, MAIN + "/", "same-site, cross-origin");
		await expectRef(xsite, MAIN + "/", "cross-site https");
		await expectRef(down, null, "downgrade to http");
		`,
	}),
	...POLICIES.map((policy) =>
		referrerTest({
			name: `referrer-https-downgrade-${policy}`,
			https: true,
			js: `
			const init = { referrerPolicy: ${JSON.stringify(policy)} };
			const down = uid("down");
			await fetch(rurl(INSECURE, down), init);
			await expectRef(down, ${EXPECT_DOWNGRADE[policy]}, "fetch referrerPolicy on a downgrade");
			`,
		})
	),
	...POLICIES.map((policy) =>
		referrerTest({
			name: `referrer-https-document-policy-downgrade-${policy}`,
			https: true,
			pageHeaders: { "Referrer-Policy": policy },
			js: `
			const down = uid("down"), img = uid("img"), frame = uid("frame");
			await fetch(rurl(INSECURE, down));
			await loadEl("img", { src: rurl(INSECURE, img, {}, ".png") });
			await expectRef(down, ${EXPECT_DOWNGRADE[policy]}, "fetch on a downgrade");
			await expectRef(img, ${EXPECT_DOWNGRADE[policy]}, "img on a downgrade");
			await expectFrame(durl(INSECURE, frame), frame, ${EXPECT_DOWNGRADE[policy]}, "iframe on a downgrade");
			`,
		})
	),
	referrerTest({
		name: "referrer-https-redirect-downgrade",
		https: true,
		js: `
		const dest = uid("dest"), up = uid("up");
		await fetch(rurl(MAIN, uid("h"), { to: rurl(INSECURE, dest) }));
		await expectRef(dest, null, "redirected to http");
		await fetch(rurl(MAIN, uid("h"), { to: rurl(INSECURE, uid("h"), { to: rurl(MAIN, up) }) }));
		await expectRef(up, null, "a referrer dropped on a downgrade stays dropped");
		`,
	}),
	referrerTest({
		name: "referrer-top-level-navigation-has-no-referrer",
		scramjetOnly: true,
		js: `
		assertEqual(document.referrer, "", "a navigation the embedder started has no referrer");
		`,
	}),
];
