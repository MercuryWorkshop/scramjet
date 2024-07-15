
window.location.href = "http://example.com"


console.log(top.window.aaa)
consle.log(globalThis["win" + "dow"])

globalThis.eval("..")

let ref = { b: this.top.window, c: globalThis["win" + "dow"] }
