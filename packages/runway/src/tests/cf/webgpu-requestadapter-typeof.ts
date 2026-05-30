import { basicTest } from "../../testcommon.ts";

// Exact WebGPU probe from payload2_lifted.js:16805-16815 and duplicate path
// 17360-17370:
//
//   window.GPU
//   GPU.prototype
//   GPU.prototype.requestAdapter
//   label literal "requestAdapter"
//
// Lifted type damage records `typeof prototype`; include both that and the
// intended method type.

export default basicTest({
	name: "cf-webgpu-requestadapter-typeof",
	js: `
    const ctor = window.GPU;
    const proto = ctor && ctor.prototype;
    const value = proto && proto.requestAdapter;
    const observed = {
      constructorType: typeof ctor,
      prototypeTypeDamaged: typeof proto,
      requestAdapterType: typeof value,
      navigatorGpuType: typeof navigator.gpu,
    };

    if (ctor) {
      assert(observed.requestAdapterType === "function",
        "GPU.prototype.requestAdapter should be function, got: " + observed.requestAdapterType);
    }

    assertConsistent("webgpu-requestadapter-typeof", observed);
  `,
});
