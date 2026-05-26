import { basicTest } from "../../testcommon.ts";

// Adapted from VM functions (full call chain):
//
// p2_func_14382_227 (line 25962-25973):
//   1. navigator.permissions → check existence
//   2. if permissions exists → query geolocation/notifications/camera/microphone
//   3. else → Promise.resolve fallback
//
// p2_func_14493_59 (line 25990-25997):
//   "geolocationAnotificationsAcameraAmicrophone".split("A") → permission names
//
// p2_func_14680_183 (line 25975-25980):
//   navigator.getBattery → check existence
//
// p2_func_14195_235 (line 25956-25960):
//   navigator.getGamepads → check existence
//
// p2_func_14145_29 (line 25999-26007):
//   _cf_chl_opt.fBtb1["pg.ref"] → gamepad reference string
//   navigator.getGamepads → check
//
// p2_func_212958_231 (line 2375-2386):
//   navigator.mediaCapabilities → check existence
//
// p2_func_63169 context (line 21091+):
//   navigator.keyboard → check existence
//
// p2_func_46091_111 (line 22104-22112):
//   navigator.gpu.wgslLanguageFeatures → check existence
//
// p2_func_46009_19 (line 22190-22195):
//   navigator.gpu.getPreferredCanvasFormat() → call method
//
// p2_func_120922_237 (line 14130-14134):
//   Window.prototype.postMessage → check exists
//
// Notification checks (common anti-bot pattern)

export default basicTest({
  name: "cf-navigator-api-probes",
  js: `
    // Check 1: navigator.permissions (p2_func_14382_227)
    if (navigator.permissions) {
      assert(typeof navigator.permissions.query === "function",
        "navigator.permissions.query should be a function");

      // Check specific permission types (p2_func_14493_59)
      const permissionNames = ["geolocation", "notifications", "camera", "microphone"];
      for (const name of permissionNames) {
        try {
          const result = await navigator.permissions.query({ name });
          assert(typeof result.state === "string",
            "permissions.query('" + name + "').state should be a string, got: " + typeof result.state);
        } catch (_) {
          // Permission name may not be supported in this context
        }
      }
    }

    // Check 2: navigator.getGamepads (p2_func_14195_235, p2_func_14145_29)
    if (typeof navigator.getGamepads === "function") {
      const gamepads = navigator.getGamepads();
      assert(gamepads instanceof Array || gamepads === null,
        "navigator.getGamepads() should return an array or null");
    }

    // Check 3: navigator.getBattery (p2_func_14680_183)
    if (typeof navigator.getBattery === "function") {
      try {
        const battery = await navigator.getBattery();
        assert(typeof battery.level === "number",
          "getBattery().level should be a number");
      } catch (_) {}
    }

    // Check 4: navigator.keyboard (line 21091)
    if (navigator.keyboard) {
      assert(typeof navigator.keyboard === "object",
        "navigator.keyboard should be an object");
    }

    // Check 5: navigator.mediaCapabilities (p2_func_212958_231)
    if (navigator.mediaCapabilities) {
      assert(typeof navigator.mediaCapabilities === "object",
        "navigator.mediaCapabilities should be an object");
    }

    // Check 6: navigator.gpu (p2_func_46091_111)
    if (navigator.gpu) {
      assert(typeof navigator.gpu === "object",
        "navigator.gpu should be an object");
    }

    // Check 7: window.postMessage (p2_func_120922_237)
    assert(typeof window.postMessage === "function",
      "window.postMessage should be a function");

    // Check 8: Notification API
    if ("Notification" in window) {
      assert(typeof Notification.permission === "string",
        "Notification.permission should be a string");
    }

    // Check 9: document.referrer (p2_func_14061_123, p2_func_14114_99)
    assert(typeof document.referrer === "string",
      "document.referrer should be a string");
  `,
});