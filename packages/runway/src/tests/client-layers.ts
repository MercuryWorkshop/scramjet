import { basicTest } from "../testcommon.ts";

// client.Proxy / client.Trap stacking on one member, over and alongside
// client.Intercept. An embedder has the whole client, so these run from the
// page with it.
const client = `const c = window[Symbol.for("scramjet client global")];`;

export default [
	basicTest({
		name: "client-layers-order",
		scramjetOnly: true,
		js: `
  ${client}
  const log = [];
  c.Proxy("Document.prototype.createComment", { apply() { log.push("inner"); } });
  c.Proxy("Document.prototype.createComment", { apply() { log.push("outer"); } });
  const node = document.createComment("x");
  assertEqual(log.join(","), "outer,inner", "latest is outermost");
  assertEqual(node.data, "x", "falls through to the native");
`,
	}),
	basicTest({
		name: "client-layers-fn-and-next",
		scramjetOnly: true,
		js: `
  ${client}
  c.Proxy("Document.prototype.createComment", {
    apply(ctx) { ctx.args[0] = "inner:" + ctx.args[0]; },
  });
  c.Proxy("Document.prototype.createComment", {
    apply(ctx) {
      const viaNext = ctx.next(ctx.this, ["a"]);
      const viaFn = Reflect.apply(ctx.fn, ctx.this, ["b"]);
      ctx.return([viaNext.data, viaFn.data]);
    },
  });
  const r = document.createComment("z");
  assertEqual(r.join(","), "inner:a,b", "next runs the layers under, fn is the native");
`,
	}),
	basicTest({
		name: "client-layers-call-chains",
		scramjetOnly: true,
		js: `
  ${client}
  c.Proxy("Document.prototype.createComment", {
    apply(ctx) { ctx.return(ctx.call().data + "!"); },
  });
  c.Proxy("Document.prototype.createComment", {
    apply(ctx) { ctx.return(ctx.call() + "?"); },
  });
  assertEqual(document.createComment("x"), "x!?");
`,
	}),
	basicTest({
		name: "client-layers-same-handler-once",
		scramjetOnly: true,
		js: `
  ${client}
  let n = 0;
  const h = { apply() { n++; } };
  c.Proxy("Document.prototype.createComment", h);
  c.Proxy("Document.prototype.createComment", h);
  document.createComment("x");
  assertEqual(n, 1, "one handler object is one layer");
`,
	}),
	basicTest({
		name: "client-layers-over-intercept",
		scramjetOnly: true,
		js: `
  ${client}
  // EventTarget.prototype.addEventListener belongs to shared/event.ts's
  // Intercept, which used to make a second patch get skipped outright
  let seen = [];
  c.Proxy("EventTarget.prototype.addEventListener", {
    apply(ctx) { seen.push([typeof ctx.args[0], !!ctx.this && ctx.this.document === document]); },
  });
  new EventTarget().addEventListener(5, () => {});
  addEventListener("rvlayers", () => {});
  assertEqual(JSON.stringify(seen), JSON.stringify([["string", false], ["string", true]]),
    "wrapper runs, after the binding converted the arguments and substituted the global");

  let fired = 0;
  const t = new EventTarget();
  t.addEventListener("go", () => fired++);
  t.dispatchEvent(new Event("go"));
  assertEqual(fired, 1, "Intercept's implementation still runs underneath");
`,
	}),
	basicTest({
		name: "client-layers-identity",
		scramjetOnly: true,
		js: `
  ${client}
  const before = EventTarget.prototype.addEventListener;
  let hit = 0;
  c.Proxy("EventTarget.prototype.addEventListener", { apply() { hit++; } });
  c.Proxy("EventTarget.prototype.addEventListener", { apply() { hit++; } });
  assert(EventTarget.prototype.addEventListener === before, "layering never replaces the member");
  before.call(new EventTarget(), "x", () => {});
  assertEqual(hit, 2, "a reference taken earlier reaches later layers");
  assertEqual(
    Function.prototype.toString.call(before),
    "function addEventListener() { [native code] }",
    "one unproxy hop to the native"
  );
  assert(Function.prototype.constructor === Function, "Function.prototype.constructor");
  assert(Request.prototype.constructor === Request, "Request.prototype.constructor");
`,
	}),
	basicTest({
		name: "client-layers-construct-over-intercept",
		scramjetOnly: true,
		js: `
  ${client}
  const log = [];
  c.Proxy("Request", { construct(ctx) { log.push(ctx.args.length); } });
  const r = new Request("https://example.com/");
  assert(r instanceof Request, "instance");
  class Sub extends Request {}
  assert(new Sub("https://example.com/") instanceof Sub, "subclass keeps its newTarget");
  assertEqual(log.join(","), "1,1");
`,
	}),
	basicTest({
		name: "client-layers-trap-stack",
		scramjetOnly: true,
		js: `
  ${client}
  c.Trap("Node.prototype.textContent", { get(ctx) { return "[" + ctx.get() + "]"; } });
  c.Trap("Node.prototype.textContent", { get(ctx) { return "(" + ctx.get() + ")"; } });
  const d = document.createElement("div");
  d.textContent = "hi";
  assertEqual(d.textContent, "([hi])");
  const desc = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  assertEqual(typeof desc.set, "function", "untrapped half is still there");
`,
	}),
	basicTest({
		name: "client-layers-intercept-closed-after-hook",
		scramjetOnly: true,
		js: `
  ${client}
  let threw = false;
  try {
    c.Intercept(class extends EventTarget {});
  } catch {
    threw = true;
  }
  assert(threw, "Intercept after hook throws");
`,
	}),
];
