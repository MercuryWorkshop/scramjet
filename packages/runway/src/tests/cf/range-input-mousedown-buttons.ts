import { basicTest } from "../../testcommon.ts";

// Exact range input MouseEvent flow from payload2_lifted.js:22549-22568:
// reads SDGM5.value/draggable, creates input[type=range], adds mousedown listener,
// creates new MouseEvent("mousedown", { buttons: 1 }), dispatches it.
// Line 22564 is register-damaged; the raw observable event flow is preserved.

export default basicTest({
	name: "cf-range-input-mousedown-buttons",
	js: `
    const arg = { SDGM5: { value: "range-source-value" }, draggable: true };
    const pushed = [];
    pushed.push(arg.SDGM5.value);
    const valueFalsy = !arg.SDGM5.value;
    const draggable = arg.draggable;
    pushed.push(arg);

    const input = document.createElement("input");
    input.type = "range";
    const seen = [];
    input.addEventListener("mousedown", function(event) {
      seen.push({
        type: event.type,
        buttons: event.buttons,
        button: event.button,
        isTrusted: event.isTrusted,
        targetType: event.target && event.target.type,
      });
    });
    const init = { buttons: 1 };
    const event = new MouseEvent("mousedown", init);
    const dispatchResult = input.dispatchEvent(event);

    const observed = {
      pushedValue: pushed[0],
      pushedArgSame: pushed[1] === arg,
      valueFalsy,
      draggable,
      inputType: input.type,
      eventButtons: event.buttons,
      eventButton: event.button,
      dispatchResult,
      seen,
    };

    assert(observed.inputType === "range", "input type should be range");
    assert(observed.eventButtons === 1, "MouseEvent buttons should be 1");
    assert(seen.length === 1 && seen[0].buttons === 1, "mousedown listener buttons mismatch");
    assertConsistent("range-input-mousedown-buttons", observed);
  `,
});
