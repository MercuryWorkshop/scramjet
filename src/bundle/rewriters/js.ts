import { parseModule } from "meriyah";
import { generate } from "astring";
import { encodeUrl } from "./url";
import { replace } from "estraverse";

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
        const ast = parseModule(js);
    
        // const identifierList = [
        //     "window",
        //     "self",
        //     "globalThis",
        //     "parent",
        //     "top",
        //     "location",
        //     ""
        // ]
    
        replace(ast, {
            enter: (node, parent) => {
                if (["ImportDeclaration", "ImportExpression", "ExportAllDeclaration", "ExportNamedDeclaration"].includes(node.type) && node.source) {
                    node.source.value = encodeUrl(node.source.value, origin);
                }

                return node;
            },

            fallback: "iteration"
        })
    
        return generate(ast);
    } catch (err) {
        throw new Error(err);
    }
}