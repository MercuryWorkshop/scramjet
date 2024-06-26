import { parseModule } from "meriyah";
import { generate } from "astring";
import { makeTraveler } from "astravel";
import { encodeUrl } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be

// js rewiter is NOT finished

// location
// window
// self
// globalThis
// this
// top
// parent


export function rewriteJs(js: string, origin?: URL) {
    try {
        const ast = parseModule(js, {
            module: true,
            webcompat: true
        });
    
        // const identifierList = [
        //     "window",
        //     "self",
        //     "globalThis",
        //     "parent",
        //     "top",
        //     "location",
        //     ""
        // ]
    
        const customTraveler = makeTraveler({
            ImportDeclaration: (node) => {
                node.source.value = encodeUrl(node.source.value, origin);
            },
    
            ImportExpression: (node) => {
                node.source.value = encodeUrl(node.source.value, origin);
            },
    
            ExportAllDeclaration: (node) => {
                node.source.value = encodeUrl(node.source.value, origin);
            },
    
            ExportNamedDeclaration: (node) => {
                if (node.source) node.source.value = encodeUrl(node.source.value, origin);
            },
            //add expiremental support for fetch()
            CallExpression: (node) => {
                if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
                    if (node.arguments.length > 0 && node.arguments[0].type === "Literal") {
                        node.arguments[0].value = encodeUrl(node.arguments[0].value, origin);
                    }
                }

                if (node.callee.type === "MemberExpression" && node.callee.object.name === "XMLHttpRequest" && node.callee.property.name === "open") {
                    if (node.arguments.length > 1 && node.arguments[1].type === "Literal") {
                        node.arguments[1].value = encodeUrl(node.arguments[1].value, origin);
                    }
                }
            },
            //load dynamic scripts (NEEDS MORE TESTING)
            NewExpression: (node) => {
                if (node.callee.type === "Identifier" && node.callee.name === "Script") {
                    const srcIndex = node.arguments.findIndex(arg => arg.type === "Literal" && typeof arg.value === "string");
                    if (srcIndex !== -1) {
                        node.arguments[srcIndex].value = encodeUrl(node.arguments[srcIndex].value, origin);
                    }
                }
            },

            AssignmentExpression: (node) => {
                if (node.left.type === "MemberExpression" && node.left.property.type === "Identifier" && node.left.property.name === "src") {
                    if (node.right.type === "Literal" && typeof node.right.value === "string") {
                        node.right.value = encodeUrl(node.right.value, origin);
                    }
                }
            }
        });
    
        customTraveler.go(ast);

        return generate(ast);
    } catch (error) {
        console.error(error);
        console.log(js);

        return js;
    }
}
