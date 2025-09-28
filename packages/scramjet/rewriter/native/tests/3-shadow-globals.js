
function f(location, globalThis) {
  assert(location === 1)
  assert(globalThis === 2)
}

f(1, 2);
