import { basicTest } from "../../testcommon.ts";

// Exact refresh link listener from inner.js_translated.js:3657-3664:
//   W.querySelectorAll(".refresh_link")
//   addEventListener("click", handler)
//   handler preventDefault(); _cf_chl_opt.GWrU4(this.getAttribute("data-cf-reload-id"))

export default basicTest({
	name: "cf-inner-refresh-link-gwru4-click",
	js: `
    const container = document.createElement("div");
    const first = document.createElement("a");
    const second = document.createElement("a");
    first.className = "refresh_link";
    second.className = "refresh_link";
    first.href = "#first";
    second.href = "#second";
    first.setAttribute("data-cf-reload-id", "first-reload-id");
    second.setAttribute("data-cf-reload-id", "second-reload-id");
    container.append(first, second);
    document.body.appendChild(container);

    const calls = [];
    window._cf_chl_opt = {
      GWrU4(value) {
        calls.push({ value, thisIsOpt: this === window._cf_chl_opt });
      },
    };

    try {
      const links = container.querySelectorAll(".refresh_link");
      for (let i = 0; i < links.length; i++) {
        links[i].addEventListener("click", function(event) {
          event.preventDefault();
          window._cf_chl_opt.GWrU4(this.getAttribute("data-cf-reload-id"));
        });
      }

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const dispatchResult = second.dispatchEvent(event);
      const observed = {
        linkCount: links.length,
        dispatchResult,
        defaultPrevented: event.defaultPrevented,
        calls,
      };

      assert(observed.linkCount === 2, "refresh_link query count mismatch");
      assert(observed.dispatchResult === false, "cancelable click dispatch should return false after preventDefault");
      assert(observed.defaultPrevented === true, "click default should be prevented");
      assert(calls.length === 1 && calls[0].value === "second-reload-id", "GWrU4 reload id mismatch");
      assertConsistent("inner-refresh-link-gwru4-click", observed);
    } finally {
      container.remove();
      delete window._cf_chl_opt;
    }
  `,
});
