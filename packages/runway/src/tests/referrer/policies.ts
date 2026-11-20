import { EXPECT, fetchMatrix, POLICIES, referrerTest } from "./fixture.ts";

// The document's referrer policy, from its Referrer-Policy header and from
// <meta name="referrer">, and what every kind of request makes of it.

const headerPolicyTests = POLICIES.map((policy) =>
	referrerTest({
		name: `referrer-header-policy-${policy}`,
		pageHeaders: { "Referrer-Policy": policy },
		js: `
		${fetchMatrix(policy)}
		const img = uid("img"), ximg = uid("ximg");
		await loadEl("img", { src: rurl(MAIN, img, {}, ".png") });
		await loadEl("img", { src: rurl(ALT, ximg, {}, ".png") });
		await expectRef(img, ${EXPECT[policy].same}, "same-origin img");
		await expectRef(ximg, ${EXPECT[policy].cross}, "cross-origin img");

		const f = uid("f"), xf = uid("xf");
		await expectFrame(durl(MAIN, f), f, ${EXPECT[policy].same}, "same-origin iframe");
		await expectFrame(durl(ALT, xf), xf, ${EXPECT[policy].cross}, "cross-origin iframe");
		`,
	})
);

const metaPolicyTests = POLICIES.map((policy) =>
	referrerTest({
		name: `referrer-meta-policy-${policy}`,
		head: `<meta name="referrer" content="${policy}">`,
		js: `
		${fetchMatrix(policy)}
		const f = uid("f"), xf = uid("xf");
		await expectFrame(durl(MAIN, f), f, ${EXPECT[policy].same}, "same-origin iframe");
		await expectFrame(durl(ALT, xf), xf, ${EXPECT[policy].cross}, "cross-origin iframe");
		`,
	})
);

export default [
	referrerTest({
		name: "referrer-default-policy-is-strict-origin-when-cross-origin",
		js: `
		${fetchMatrix("strict-origin-when-cross-origin")}
		assertEqual(new Request("/x").referrerPolicy, "", "a Request's own policy is empty by default");
		`,
	}),
	...headerPolicyTests,
	...metaPolicyTests,

	// Referrer-Policy header parsing: a comma separated list whose last
	// recognised token wins, unknown tokens being skipped
	referrerTest({
		name: "referrer-header-last-valid-token-wins",
		pageHeaders: { "Referrer-Policy": "no-referrer, unsafe-url" },
		js: fetchMatrix("unsafe-url"),
	}),
	referrerTest({
		name: "referrer-header-unknown-trailing-token-ignored",
		pageHeaders: { "Referrer-Policy": "unsafe-url, not-a-policy" },
		js: fetchMatrix("unsafe-url"),
	}),
	referrerTest({
		name: "referrer-header-only-unknown-tokens-uses-default",
		pageHeaders: { "Referrer-Policy": "not-a-policy" },
		js: fetchMatrix("strict-origin-when-cross-origin"),
	}),
	referrerTest({
		name: "referrer-header-multiple-fields-combine",
		pageHeaders: { "Referrer-Policy": ["unsafe-url", "no-referrer"] },
		js: fetchMatrix("no-referrer"),
	}),
	referrerTest({
		name: "referrer-header-whitespace-and-empty-tokens",
		pageHeaders: { "Referrer-Policy": "  origin ,, " },
		js: fetchMatrix("origin"),
	}),
	referrerTest({
		name: "referrer-header-token-case",
		pageHeaders: { "Referrer-Policy": "No-Referrer" },
		js: `
		const id = uid("case");
		await fetch(rurl(ALT, id));
		assertConsistent("header token case", await seen(id));
		`,
	}),

	// <meta name="referrer">
	referrerTest({
		name: "referrer-meta-overrides-header",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		head: `<meta name="referrer" content="unsafe-url">`,
		js: fetchMatrix("unsafe-url"),
	}),
	referrerTest({
		name: "referrer-meta-invalid-value-ignored",
		pageHeaders: { "Referrer-Policy": "origin" },
		head: `<meta name="referrer" content="not-a-policy">`,
		js: fetchMatrix("origin"),
	}),
	referrerTest({
		name: "referrer-meta-legacy-never",
		head: `<meta name="referrer" content="never">`,
		js: fetchMatrix("no-referrer"),
	}),
	referrerTest({
		name: "referrer-meta-legacy-always",
		head: `<meta name="referrer" content="always">`,
		js: fetchMatrix("unsafe-url"),
	}),
	referrerTest({
		name: "referrer-meta-legacy-origin-when-crossorigin",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		head: `<meta name="referrer" content="origin-when-crossorigin">`,
		js: fetchMatrix("origin-when-cross-origin"),
	}),
	referrerTest({
		name: "referrer-meta-legacy-default",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		head: `<meta name="referrer" content="default">`,
		js: `
		const same = uid("same"), alt = uid("alt");
		await fetch(rurl(MAIN, same));
		await fetch(rurl(ALT, alt));
		assertConsistent("meta default, same-origin", await seen(same));
		assertConsistent("meta default, cross-origin", await seen(alt));
		`,
	}),
	referrerTest({
		name: "referrer-meta-last-one-wins",
		head: `<meta name="referrer" content="no-referrer"><meta name="referrer" content="origin">`,
		js: fetchMatrix("origin"),
	}),
	referrerTest({
		name: "referrer-meta-in-body",
		body: `<meta name="referrer" content="no-referrer">`,
		js: fetchMatrix("no-referrer"),
	}),
	referrerTest({
		name: "referrer-meta-inserted-dynamically",
		js: `
		${fetchMatrix("strict-origin-when-cross-origin")}
		const meta = document.createElement("meta");
		meta.name = "referrer";
		meta.content = "no-referrer";
		document.head.append(meta);
		${fetchMatrix("no-referrer")}
		const later = document.createElement("meta");
		later.name = "referrer";
		later.content = "unsafe-url";
		document.head.prepend(later);
		${fetchMatrix("unsafe-url")}
		`,
	}),
	referrerTest({
		name: "referrer-meta-removal-keeps-policy",
		head: `<meta id="m" name="referrer" content="no-referrer">`,
		js: `
		document.getElementById("m").remove();
		${fetchMatrix("no-referrer")}
		`,
	}),
	referrerTest({
		name: "referrer-meta-content-change",
		head: `<meta id="m" name="referrer" content="no-referrer">`,
		js: `
		document.getElementById("m").content = "unsafe-url";
		const alt = uid("alt");
		await fetch(rurl(ALT, alt));
		assertConsistent("after content change", await seen(alt));
		`,
	}),
	referrerTest({
		name: "referrer-meta-http-equiv",
		head: `<meta http-equiv="Referrer-Policy" content="no-referrer">`,
		js: `
		const same = uid("same");
		await fetch(rurl(MAIN, same));
		assertConsistent("http-equiv referrer-policy", await seen(same));
		`,
	}),
	referrerTest({
		name: "referrer-meta-name-case-insensitive",
		head: `<meta name="REFERRER" content="no-referrer">`,
		js: `
		const same = uid("same");
		await fetch(rurl(MAIN, same));
		assertConsistent("uppercase meta name", await seen(same));
		`,
	}),

	// the policy the page reads back
	referrerTest({
		name: "referrer-policy-not-visible-in-request-defaults",
		pageHeaders: { "Referrer-Policy": "no-referrer" },
		js: `
		assertEqual(new Request("/x").referrerPolicy, "", "Request.referrerPolicy doesn't reflect the document's");
		assertEqual(new Request("/x").referrer, "about:client");
		assertEqual(document.createElement("img").referrerPolicy, "");
		`,
	}),
];
