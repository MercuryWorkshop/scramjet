import { basicTest } from "../../testcommon.ts";

// Exact inner VM eval/XOR installation from inner.vm_lifted.js:18-25:
//
//   source = "function nKhd2(s){return function(k){for(var o=new Uint8Array(k.length),i=0;i<k.length;i++)o[i]=k[i]^s.charCodeAt(i%s.length);return o}}"
//   eval(window.zjVu3(source))
//   window.ZUopw9 = nKhd2("qKEZqepCWohJStNY")

export default basicTest({
	name: "cf-inner-nkhd2-xor-eval",
	js: `
    const previousZjVu3 = window.zjVu3;
    const previousZUopw9 = window.ZUopw9;
    const previousNKhd2 = window.nKhd2;

    try {
      window.zjVu3 = function(s) { return s; };
      const source = "function nKhd2(s){return function(k){for(var o=new Uint8Array(k.length),i=0;i<k.length;i++)o[i]=k[i]^s.charCodeAt(i%s.length);return o}}";
      eval(window.zjVu3(source));
      window.ZUopw9 = nKhd2("qKEZqepCWohJStNY");

      const input = new Uint8Array([0, 1, 2, 3, 255, 128, 65, 90]);
      const output = Array.from(window.ZUopw9(input));
      const key = "qKEZqepCWohJStNY";
      const expected = Array.from(input).map((value, index) => value ^ key.charCodeAt(index % key.length));
      const observed = {
        sourceLength: source.length,
        nKhd2Type: typeof nKhd2,
        ZUopw9Type: typeof window.ZUopw9,
        output,
        expected,
      };

      assert(observed.nKhd2Type === "function", "nKhd2 should be installed by eval");
      assert(observed.ZUopw9Type === "function", "ZUopw9 should be installed");
      assert(JSON.stringify(output) === JSON.stringify(expected), "xor output mismatch");
      assertConsistent("inner-nkhd2-xor-eval", observed);
    } finally {
      if (previousZjVu3 === undefined) delete window.zjVu3;
      else window.zjVu3 = previousZjVu3;
      if (previousZUopw9 === undefined) delete window.ZUopw9;
      else window.ZUopw9 = previousZUopw9;
      if (previousNKhd2 === undefined) delete window.nKhd2;
      else window.nKhd2 = previousNKhd2;
    }
  `,
});
