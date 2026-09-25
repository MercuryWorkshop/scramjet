import tests from "./copies/cache-keying.mts";
const arr = Array.isArray(tests) ? tests : [tests];
for (const t of arr) t.name = "rv5adv-" + t.name;
export default arr;
