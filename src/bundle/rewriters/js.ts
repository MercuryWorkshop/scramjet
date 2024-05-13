import { parse } from "meriyah";
import { generate } from "astring";
import { makeTraveler } from "astravel";
import { encodeUrl } from "./url";

// i am a cat. i like to be petted. i like to be fed. i like to be

export function rewriteJs(js: string, origin?: string) {
    const ast = parse(js, {
        module: true
    });

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
        }
    });

    customTraveler.go(ast);
    
    return generate(ast);
}