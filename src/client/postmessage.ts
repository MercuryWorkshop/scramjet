window.postMessage = new Proxy(window.postMessage, {
  apply(target, thisArg, argArray) {
    if (typeof argArray[1] === "string") argArray[1] = "*"
    Reflect.apply(target, thisArg, argArray);
  }
});
