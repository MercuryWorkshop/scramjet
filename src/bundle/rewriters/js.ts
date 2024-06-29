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
        });
    
        customTraveler.go(ast);
    
        return generate(ast);
    } catch {
        console.log(js);

        return js;
    }
}
