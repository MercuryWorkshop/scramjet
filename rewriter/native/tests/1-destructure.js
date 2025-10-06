// declartion bindings
// sanity
{
  const { location: x } = globalThis;
  check(x);
}
{
  let { location: x } = globalThis;
  check(x);
}
{
  var { location: x } = globalThis;
  check(x);
}
// bindingproperty
{
  const { location } = globalThis;
  check(location);
  const { eval } = globalThis;
  check(eval);
}
// object target
{
  const { g: { eval } } = { g: globalThis };
  check(eval);

  const { g: { r: { location } } } = { g: { r: globalThis } };
  check(location);
}
// rest pattern
{
  const { ...rest } = globalThis;
  check(rest.location);
  check(rest.top);
  check(rest.eval);
}
// making sure var can't overwrite location
{
  var { g: location } = { g: "j" }
}
{
  var { location } = { location: "j" }
}
{
  var { ...location } = { toString() { return "j" } }
}

// destructuring with computed property names
{
  const prop = 'eval';
  const { [prop]: x } = globalThis;
  check(x);
}

// multiple declarations
{
  const { eval } = globalThis, { location } = globalThis;
  check(eval);
  check(location);
}

// with property accessor inside destructuring
{
  const obj = { g: globalThis };
  const { g: { ['loc' + 'ation']: x, ['ev' + 'al']: y } } = obj;
  check(x);
  check(y);
}

// Nested destructuring with computed property names
{
  const key1 = 'g';
  const key2 = 'eval';
  const wrapper = { g: globalThis };
  const { [key1]: { [key2]: x } } = wrapper;
  check(x);
}

// Function returning destructured object
{
  function getGlobals() {
    const { eval, location } = globalThis;
    return { e: eval, l: location };
  }
  const { e, l } = getGlobals();
  check(e);
  check(l);
}


// destructuring with multiple computed properties
{
  const prop1 = 'eval';
  const prop2 = 'location';
  const { [prop1]: x, [prop2]: y } = globalThis;
  check(x);
  check(y);
}

// destructuring in for-of loops
for (const { location, eval } of [globalThis]) {
  check(location);
  check(eval);
}

// destructuring in function parameters
(function({ eval, location }) {
  check(eval);
  check(location);
})(globalThis);


// conditional destructuring (try/catch)
try {
  throw globalThis;
} catch ({ eval, location }) {
  check(eval);
  check(location);
}
