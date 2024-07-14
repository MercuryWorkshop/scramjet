// idk what shit has to be done on here but it has to be done
// i'm going to temporarily disable rewriting if a MemberExpression detects addEventListener

// window.addEventListener = new Proxy(window.addEventListener, {
//     apply (target, thisArg, argArray) {
//         //
        
//         return Reflect.apply(target, thisArg, argArray);
//     }
// })