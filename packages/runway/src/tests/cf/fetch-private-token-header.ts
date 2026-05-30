import { basicTest } from "../../testcommon.ts";

// Exact fetch/response observation from payload2_lifted.js:5288-5362:
//
//   fetch(arg_0, undefined).then(response => {
//     response.headers;
//     response.headers.get("private-token-client-replay");
//     response.ok;
//     if (!response.ok) asyncWaitReplay(!ok, retryFn, undefined)
//   }).catch(errorHandler)
//
// Runway uses the current page root as the concrete URL for this strict shape;
// the source observes response shape and the named header, not response body.

export default basicTest({
	name: "cf-fetch-private-token-header",
	timeoutMs: 10000,
	js: `
    let first;
    let retry;
    let caughtName = null;

    try {
      const response = await fetch(location.href, undefined);
      first = {
        ok: response.ok,
        status: response.status,
        headersType: typeof response.headers,
        headerGetType: typeof response.headers.get,
        privateTokenClientReplay: response.headers.get("private-token-client-replay"),
      };

      if (!response.ok) {
        const retryResponse = await fetch(location.href, undefined);
        retry = {
          ok: retryResponse.ok,
          status: retryResponse.status,
          privateTokenClientReplay: retryResponse.headers.get("private-token-client-replay"),
        };
      }
    } catch (error) {
      caughtName = error && error.name;
    }

    const observed = { first, retry: retry || null, caughtName };

    assert(caughtName === null,
      "fetch(location.href, undefined) should not throw, got: " + caughtName);
    assert(first && first.headersType === "object",
      "response.headers should be an object");
    assert(first && first.headerGetType === "function",
      "response.headers.get should be a function");
    assert(first && typeof first.ok === "boolean",
      "response.ok should be boolean");

    assertConsistent("fetch-private-token-header", observed);
  `,
});
