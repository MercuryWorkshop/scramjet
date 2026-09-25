import tests from "./copies/storage-scope-leaks.mts";
const arr = Array.isArray(tests) ? tests : [tests];
for (const t of arr) t.name = "rv5adv-" + t.name;
export default arr;
