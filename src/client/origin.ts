import { decodeUrl } from "../shared/rewriters/url";


// const descriptor = Object.getOwnPropertyDescriptor(window, "origin");
delete window.origin;

Object.defineProperty(window, "origin", {
  get() {
    return new URL(decodeUrl(location.href)).origin;
  },
  set() {
    return false;
  },
});


Object.defineProperty(document, "URL", {
  get() {
    return decodeUrl(location.href);
  },
  set() {
    return false;
  }
})

Object.defineProperty(document, "baseURI", {
  get() {
    return decodeUrl(location.href);
  },
  set() {
    return false;
  }
})

Object.defineProperty(document, "domain", {
  get() {
    return new URL(decodeUrl(location.href)).hostname;
  },
  set() {
    return false;
  }
})
