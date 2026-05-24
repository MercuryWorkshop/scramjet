// var { location } in a `for` head (was: syntax error)
for (var { location } = { location: "j" }; false; ) {}
check(location);

// var { location } in a for-of header (was: syntax error)
for (var { location } of [{ location: "j" }]) {
  check(location);
}

// var { location } in a for-in header
for (var { location } in { whatever: 1 }) {
  // `location` here will be a key string from the rhs, definitely not the global
  check(location);
}

// var { location } in an unbraced `if` body (was: side effect leaked out of the guard)
let sideEffectRan = false;
function sideEffect() { sideEffectRan = true; return { location: "j" }; }
if (false) var { location } = sideEffect();
if (sideEffectRan) fail();
check(location);

// var { location } after `export`-style top-level — top-level here is just the module body
{
  var { location } = { location: "j" };
  check(location);
}

// labeled var declaration
loop: var { location } = { location: "j" };
check(location);
