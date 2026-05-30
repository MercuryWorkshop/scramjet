import { basicTest } from "../../testcommon.ts";

// Exact WebGPU feature collection from payload2_lifted.js:24000-24045 and
// 24082-24119:
//
//   navigator.gpu.getPreferredCanvasFormat()
//   navigator.gpu.wgslLanguageFeatures
//   if present, forEach pushes each feature into an array

export default basicTest({
	name: "cf-webgpu-preferred-format-features",
	js: `
    const gpu = navigator.gpu;
    const observed = {
      gpuType: typeof gpu,
      preferredCanvasFormatType: undefined,
      preferredCanvasFormat: undefined,
      wgslLanguageFeaturesType: undefined,
      wgslLanguageFeatures: [],
    };

    if (gpu) {
      observed.preferredCanvasFormatType = typeof gpu.getPreferredCanvasFormat;
      observed.preferredCanvasFormat = gpu.getPreferredCanvasFormat();
      const features = gpu.wgslLanguageFeatures;
      observed.wgslLanguageFeaturesType = Object.prototype.toString.call(features);
      if (features) {
        features.forEach((feature) => observed.wgslLanguageFeatures.push(feature));
      }
    }

    assert(observed.gpuType === "undefined" || observed.preferredCanvasFormatType === "function",
      "navigator.gpu.getPreferredCanvasFormat should be function when gpu exists");

    assertConsistent("webgpu-preferred-format-features", observed);
  `,
});
