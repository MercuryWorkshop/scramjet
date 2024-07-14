import { parseModule } from "meriyah";
import { generate } from "astring";
import { makeTraveler } from "astravel";
import { encodeUrl } from "./url";
import * as ESTree from "estree";

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
    const htmlcomment = /<!--[\s\S]*?-->/g;
    js = js.replace(htmlcomment, "");
    try {
        const ast = parseModule(js, {
            module: true,
            webcompat: true
        });

        const identifierList = [
            "window",
            "self",
            "globalThis",
            "this",
            "parent",
            "top",
            "location"
        ]

        const customTraveler = makeTraveler({
            ImportDeclaration: (node: ESTree.ImportDeclaration) => {
                node.source.value = encodeUrl(node.source.value as string, origin);
            },

            ImportExpression: (node: ESTree.ImportExpression) => {
                if (node.source.type === "Literal") {
                    node.source.value = encodeUrl(node.source.value as string, origin);
                } else if (node.source.type === "Identifier") {
                    // this is for things that import something like
                    // const moduleName = "name";
                    // await import(moduleName);
                    node.source.name = `__wrapImport(${node.source.name})`;
                }
            },

            ExportAllDeclaration: (node: ESTree.ExportAllDeclaration) => {
                node.source.value = encodeUrl(node.source.value as string, origin);
            },

            ExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => {
                // strings are Literals in ESTree syntax but these will always be strings
                if (node.source) node.source.value = encodeUrl(node.source.value as string, origin);
            },

            MemberExpression: (node: ESTree.MemberExpression) => {
                if (node.object.type === "Identifier" && identifierList.includes(node.object.name)) {
                    node.object.name = `$s(${node.object.name})`;
                }
            },

            AssignmentExpression: (node: ESTree.AssignmentExpression) => {
                if (node.left.type === "Identifier" && identifierList.includes(node.left.name)) {
                    node.left.name = `$s(${node.left.name})`;
                }

                if (node.right.type === "Identifier" && identifierList.includes(node.right.name)) {
                    node.right.name = `$s(${node.right.name})`;
                }
            },

            VariableDeclarator: (node: ESTree.VariableDeclarator) => {
                if (node.init && node.init.type === "Identifier" && identifierList.includes(node.init.name)) {
                    node.init.name = `$s(${node.init.name})`;
                }
            }
        });

        customTraveler.go(ast);

        return generate(ast);
    } catch (e) {
        console.error(e);
        console.log(js);

        return js;
    }
}
