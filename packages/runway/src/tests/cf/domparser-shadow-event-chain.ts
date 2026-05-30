import { basicTest } from "../../testcommon.ts";

// Exact contiguous DOM chain from payload2_lifted.js:22215-22278:
//
//   create hidden-ish div with class Pkkj3
//   append style ".Pkkj3 { display: flex; }" to document.head
//   getComputedStyle(div).display
//   create div, read scrollIntoView
//   create shadow root, append span, call span.getRootNode({ composed: "attachShadow" })
//   DOMParser.parseFromString("<p>DsQjw5</div><p>MEgTf8</p>", "text/html")
//   DOMParser.parseFromString("<div data-foo=\"&#34;\"></div>", "text/html")
//   add two listeners, remove one using function object as capture arg, dispatch Event("x", { bubbles: !fn })

export default basicTest({
	name: "cf-domparser-shadow-event-chain",
	js: `
    const div = document.createElement("div");
    div.className = "Pkkj3";
    document.body.appendChild(div);
    const style = document.createElement("style");
    style.innerText = ".Pkkj3 { display: flex; }";
    document.head.appendChild(style);

    try {
      const computed = getComputedStyle(div);
      const display = computed.display;

      const scrollDiv = document.createElement("div");
      const scrollIntoViewType = typeof scrollDiv.scrollIntoView;

      const host = document.createElement("div");
      const span = document.createElement("span");
      const shadow = host.attachShadow({ mode: "open" });
      shadow.appendChild(span);
      const rootOptions = { composed: "attachShadow" };
      const root = span.getRootNode(rootOptions);

      const parserA = new DOMParser();
      const parsedA = parserA.parseFromString("<p>DsQjw5</div><p>MEgTf8</p>", "text/html");
      const parserB = new DOMParser();
      const parsedB = parserB.parseFromString('<div data-foo="&#34;"></div>', "text/html");

      const target = document.createElement("div");
      let firstCount = 0;
      let secondCount = 0;
      function firstListener() { firstCount = 0 + 1; }
      function secondListener() { secondCount = 0 + 1; }
      target.addEventListener("x", firstListener, false);
      target.addEventListener("x", secondListener, false);
      target.removeEventListener("x", firstListener, secondListener);
      const eventOptions = { bubbles: !secondListener };
      target.dispatchEvent(new Event("x", eventOptions));

      const observed = {
        display,
        scrollIntoViewType,
        rootIsShadowRoot: root === shadow,
        rootNodeType: root.nodeType,
        rootConstructorName: root.constructor.name,
        rootOptionsComposedType: typeof rootOptions.composed,
        parsedMalformedHtml: parsedA.body.innerHTML,
        parsedEntityAttribute: parsedB.body.innerHTML,
        firstCount,
        secondCount,
        eventBubbles: eventOptions.bubbles,
      };

      assert(observed.display === "flex",
        "computed display should be flex, got: " + observed.display);
      assert(observed.scrollIntoViewType === "function",
        "div.scrollIntoView typeof should be function, got: " + observed.scrollIntoViewType);
      assert(observed.firstCount === 0 && observed.secondCount === 1,
        "listener removal/dispatch counts should be 0/1, got: " + observed.firstCount + "/" + observed.secondCount);

      assertConsistent("domparser-shadow-event-chain", observed);
    } finally {
      style.remove();
      div.remove();
    }
  `,
});
