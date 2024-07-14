import { encodeUrl } from "./shared"

Worker = new Proxy(Worker, {
	construct(target, argArray) {
		argArray[0] = encodeUrl(argArray[0])

		// target is a reference to the object that you are proxying
		// Reflect.construct is just a wrapper for calling target
		// you could do new target(...argArray) and it would work the same effectively

		return Reflect.construct(target, argArray)
	},
})

Worklet.prototype.addModule = new Proxy(Worklet.prototype.addModule, {
	apply(target, thisArg, argArray) {
		argArray[0] = encodeUrl(argArray[0])

		return Reflect.apply(target, thisArg, argArray)
	},
})

// broken

// window.importScripts = new Proxy(window.importScripts, {
//     apply(target, thisArg, argArray) {
//         for (const i in argArray) {
//             argArray[i] = encodeUrl(argArray[i]);
//         }

//         return Reflect.apply(target, thisArg, argArray);
//     },
// });
