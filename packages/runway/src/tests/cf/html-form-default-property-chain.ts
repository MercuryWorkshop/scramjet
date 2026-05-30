import { basicTest } from "../../testcommon.ts";

// Exact HTML element default-property collection from payload2_lifted.js:22083-22122
// and continuation at 22125-22188:
//
//   new XMLHttpRequest(); read UNSENT
//   div.translate / div.draggable / div.spellcheck
//   input.dirName, textarea.dirName, input.maxLength, textarea.maxLength
//   option.defaultSelected, option.label
//   div.attachShadow read
//   select/options selected and selectedIndex after innerHTML assignment
//
// Some lifted pushes are register-damaged (`typeof reg_28` after reading
// spellcheck, pushing element objects rather than dirName values). This test
// records the raw observable property reads and stable primitives.

export default basicTest({
	name: "cf-html-form-default-property-chain",
	js: `
    const xhr = new XMLHttpRequest();
    const div = document.createElement("div");
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const option = document.createElement("option");

    const selectHost = document.createElement("div");
    selectHost.innerHTML = '<select><option selected value="pSeO3">pSeO3</option><option value="iIYt2">iIYt2</option></select>';
    const select = selectHost.firstChild;
    const selectedOption = select.options[0];

    const observed = {
      xhrUnsent: xhr.UNSENT,
      divTranslate: div.translate,
      divDraggable: div.draggable,
      divSpellcheck: div.spellcheck,
      divTypeAfterSpellcheckRead: typeof div,
      inputDirName: input.dirName,
      textareaDirName: textarea.dirName,
      inputMaxLength: input.maxLength,
      textareaMaxLength: textarea.maxLength,
      optionDefaultSelected: option.defaultSelected,
      optionLabel: option.label,
      attachShadowType: typeof div.attachShadow,
      selectedOptionSelected: selectedOption.selected,
      selectedIndex: select.selectedIndex,
      selectedValue: select.value,
    };

    assert(observed.xhrUnsent === 0,
      "XMLHttpRequest.UNSENT should be 0, got: " + observed.xhrUnsent);
    assert(observed.inputMaxLength === -1,
      "input.maxLength default should be -1, got: " + observed.inputMaxLength);
    assert(observed.textareaMaxLength === -1,
      "textarea.maxLength default should be -1, got: " + observed.textareaMaxLength);
    assert(observed.optionDefaultSelected === false,
      "option.defaultSelected default should be false");
    assert(observed.selectedOptionSelected === true,
      "first selected option should report selected");
    assert(observed.selectedIndex === 0,
      "select.selectedIndex should be 0, got: " + observed.selectedIndex);

    assertConsistent("html-form-default-property-chain", observed);
  `,
});
