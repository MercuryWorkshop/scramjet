import { basicTest } from "../../testcommon.ts";

// Ports the Error normalization helper from data4/inner.js_translated.js:949-988.

export default basicTest({
	name: "cf-inner-debug-error-stack-normalize",
	js: `
    function oKAYx0(W) {
      const stackLine = /^\\s*at\\s+(.+):(\\d+):(\\d+)/;
      let message;
      let file;
      let line;
      let col;

      if (W instanceof Error) {
        message = W.message;
        if (W.stack && typeof W.stack === "string") {
          const parts = W.stack.split("\\n");
          if (parts.length > 1) {
            const match = parts[1].match(stackLine);
            if (match) {
              file = match[1];
              line = parseInt(match[2], 10);
              col = parseInt(match[3], 10);
            }
          }
        }
      } else {
        message = JSON.stringify(W);
      }

      return { pMoH6: message, mcSlT9: file, yimO5: line, qmYAZ7: col, mWfy4: W };
    }

    const err = new Error("turnstile exploded");
    err.stack = "Error: turnstile exploded\\n    at https://challenge.example.test/inner.js:123:45";
    const normalized = oKAYx0(err);
    const observed = {
      message: normalized.pMoH6,
      file: normalized.mcSlT9,
      line: normalized.yimO5,
      col: normalized.qmYAZ7,
      sameError: normalized.mWfy4 === err,
    };

    assert(observed.message === "turnstile exploded", "error message should be preserved");
    assert(observed.line === 123 && observed.col === 45, "stack location should be parsed");
    assertConsistent("inner-debug-error-stack-normalize", observed);
  `,
});
