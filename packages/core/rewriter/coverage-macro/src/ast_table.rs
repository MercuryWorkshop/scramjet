//! Hand-maintained shape table for the oxc AST nodes we care about.
//!
//! For each node type, lists its AST-typed fields with shape info so the
//! macro can compute Expression-reachability and emit walk code.
//!
//! Fields that are not AST nodes (literals, bools, atoms, spans) are omitted.
//! A field omitted here is treated as "not in R" — meaning it can be skipped
//! freely. If oxc adds a new AST field to a type, it must be added here.

#[derive(Copy, Clone, Debug)]
pub enum Cardinality {
    One,
    Opt,
    Vec,
}

#[derive(Copy, Clone, Debug)]
pub struct Field {
    pub name: &'static str,
    pub ty: &'static str,
    pub card: Cardinality,
}

#[derive(Copy, Clone, Debug)]
pub struct NodeDef {
    pub name: &'static str,
    pub fields: &'static [Field],
    pub variants: &'static [&'static str],
}

const fn f(name: &'static str, ty: &'static str, card: Cardinality) -> Field {
    Field { name, ty, card }
}

/// Subset of the oxc AST we explicitly model. Every node type that appears
/// as the `it: &X` parameter of a `#[coverage_checked]` method must be here,
/// along with every node type transitively reachable from those.
pub const NODES: &[NodeDef] = &[
    // ===== top-level / structural =====
    NodeDef {
        name: "Program",
        fields: &[
            f("body", "Statement", Cardinality::Vec),
            f("directives", "Directive", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "Directive",
        fields: &[f("expression", "StringLiteral", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "StringLiteral",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "IdentifierName",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "BindingIdentifier",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "PrivateIdentifier",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "TemplateElement",
        fields: &[],
        variants: &[],
    },
    // ===== Expression umbrella — this is the "R-root" =====
    NodeDef {
        name: "Expression",
        fields: &[],
        variants: &[
            "IdentifierReference",
            "ThisExpression",
            "ArrayExpression",
            "ObjectExpression",
            "FunctionExpression",
            "ArrowFunctionExpression",
            "ClassExpression",
            "ParenthesizedExpression",
            "UnaryExpression",
            "UpdateExpression",
            "BinaryExpression",
            "LogicalExpression",
            "ConditionalExpression",
            "AssignmentExpression",
            "SequenceExpression",
            "CallExpression",
            "NewExpression",
            "MemberExpression",
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
            "TaggedTemplateExpression",
            "TemplateLiteral",
            "ImportExpression",
            "MetaProperty",
            "AwaitExpression",
            "YieldExpression",
            "Super",
            "ChainExpression",
            "SpreadElement",
        ],
    },
    NodeDef {
        name: "IdentifierReference",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "ThisExpression",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "Super",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "ArrayExpression",
        fields: &[f("elements", "ArrayExpressionElement", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "ArrayExpressionElement",
        fields: &[],
        variants: &["Expression", "SpreadElement", "Elision"],
    },
    NodeDef {
        name: "Elision",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "SpreadElement",
        fields: &[f("argument", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ObjectExpression",
        fields: &[f("properties", "ObjectPropertyKind", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "ObjectPropertyKind",
        fields: &[],
        variants: &["ObjectProperty", "SpreadElement"],
    },
    NodeDef {
        name: "ObjectProperty",
        fields: &[
            f("key", "PropertyKey", Cardinality::One),
            f("value", "Expression", Cardinality::One),
            f("init", "Expression", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "PropertyKey",
        fields: &[],
        variants: &[
            "StaticIdentifier",
            "PrivateIdentifier",
            "Expression",
            "StringLiteral",
            "NumericLiteral",
            "BigIntLiteral",
            "RegExpLiteral",
        ],
    },
    NodeDef {
        name: "StaticIdentifier",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "NumericLiteral",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "BigIntLiteral",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "RegExpLiteral",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "BooleanLiteral",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "NullLiteral",
        fields: &[],
        variants: &[],
    },
    // ===== functions =====
    NodeDef {
        name: "FunctionExpression",
        fields: &[
            f("params", "FormalParameters", Cardinality::One),
            f("body", "FunctionBody", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "Function",
        fields: &[
            f("id", "BindingIdentifier", Cardinality::Opt),
            f("params", "FormalParameters", Cardinality::One),
            f("body", "FunctionBody", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ArrowFunctionExpression",
        fields: &[
            f("params", "FormalParameters", Cardinality::One),
            f("body", "FunctionBody", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "FormalParameters",
        fields: &[
            f("items", "FormalParameter", Cardinality::Vec),
            f("rest", "BindingRestElement", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "FormalParameter",
        fields: &[f("pattern", "BindingPattern", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "BindingRestElement",
        fields: &[f("argument", "BindingPattern", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "FunctionBody",
        fields: &[
            f("statements", "Statement", Cardinality::Vec),
            f("directives", "Directive", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ClassExpression",
        fields: &[f("body", "ClassBody", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ClassBody",
        fields: &[f("body", "ClassElement", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "ClassElement",
        fields: &[],
        variants: &[
            "MethodDefinition",
            "PropertyDefinition",
            "StaticBlock",
            "AccessorProperty",
        ],
    },
    NodeDef {
        name: "MethodDefinition",
        fields: &[
            f("key", "PropertyKey", Cardinality::One),
            f("value", "FunctionExpression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "PropertyDefinition",
        fields: &[
            f("key", "PropertyKey", Cardinality::One),
            f("value", "Expression", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "StaticBlock",
        fields: &[f("body", "Statement", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "AccessorProperty",
        fields: &[
            f("key", "PropertyKey", Cardinality::One),
            f("value", "Expression", Cardinality::Opt),
        ],
        variants: &[],
    },
    // ===== unary/update/etc. =====
    NodeDef {
        name: "UnaryExpression",
        fields: &[f("argument", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "UpdateExpression",
        fields: &[f("argument", "SimpleAssignmentTarget", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "BinaryExpression",
        fields: &[
            f("left", "Expression", Cardinality::One),
            f("right", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "LogicalExpression",
        fields: &[
            f("left", "Expression", Cardinality::One),
            f("right", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ConditionalExpression",
        fields: &[
            f("test", "Expression", Cardinality::One),
            f("consequent", "Expression", Cardinality::One),
            f("alternate", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "SequenceExpression",
        fields: &[f("expressions", "Expression", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "ParenthesizedExpression",
        fields: &[f("expression", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "AwaitExpression",
        fields: &[f("argument", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "YieldExpression",
        fields: &[f("argument", "Expression", Cardinality::Opt)],
        variants: &[],
    },
    NodeDef {
        name: "ChainExpression",
        fields: &[f("expression", "ChainElement", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ChainElement",
        fields: &[],
        variants: &[
            "CallExpression",
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
        ],
    },
    NodeDef {
        name: "TemplateLiteral",
        fields: &[
            f("expressions", "Expression", Cardinality::Vec),
            f("quasis", "TemplateElement", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "TaggedTemplateExpression",
        fields: &[
            f("tag", "Expression", Cardinality::One),
            f("quasi", "TemplateLiteral", Cardinality::One),
        ],
        variants: &[],
    },
    // ===== calls / members =====
    NodeDef {
        name: "CallExpression",
        fields: &[
            f("callee", "Expression", Cardinality::One),
            f("arguments", "Argument", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "NewExpression",
        fields: &[
            f("callee", "Expression", Cardinality::One),
            f("arguments", "Argument", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "Argument",
        fields: &[],
        variants: &["Expression", "SpreadElement"],
    },
    NodeDef {
        name: "MemberExpression",
        fields: &[],
        variants: &[
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
        ],
    },
    NodeDef {
        name: "StaticMemberExpression",
        fields: &[
            f("object", "Expression", Cardinality::One),
            f("property", "IdentifierName", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ComputedMemberExpression",
        fields: &[
            f("object", "Expression", Cardinality::One),
            f("expression", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "PrivateFieldExpression",
        fields: &[
            f("object", "Expression", Cardinality::One),
            f("field", "PrivateIdentifier", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ImportExpression",
        fields: &[
            f("source", "Expression", Cardinality::One),
            f("options", "Expression", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "MetaProperty",
        fields: &[
            f("meta", "IdentifierName", Cardinality::One),
            f("property", "IdentifierName", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentExpression",
        fields: &[
            f("left", "AssignmentTarget", Cardinality::One),
            f("right", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    // ===== assignment targets =====
    NodeDef {
        name: "AssignmentTarget",
        fields: &[],
        variants: &[
            "AssignmentTargetIdentifier",
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
            "ObjectAssignmentTarget",
            "ArrayAssignmentTarget",
        ],
    },
    NodeDef {
        name: "AssignmentTargetIdentifier",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "SimpleAssignmentTarget",
        fields: &[],
        variants: &[
            "AssignmentTargetIdentifier",
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
        ],
    },
    NodeDef {
        name: "ObjectAssignmentTarget",
        fields: &[
            f("properties", "AssignmentTargetProperty", Cardinality::Vec),
            f("rest", "AssignmentTargetRest", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ArrayAssignmentTarget",
        fields: &[
            f("elements", "AssignmentTargetMaybeDefault", Cardinality::Vec),
            f("rest", "AssignmentTargetRest", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentTargetRest",
        fields: &[f("target", "AssignmentTarget", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentTargetMaybeDefault",
        fields: &[],
        variants: &[
            "AssignmentTargetIdentifier",
            "StaticMemberExpression",
            "ComputedMemberExpression",
            "PrivateFieldExpression",
            "ObjectAssignmentTarget",
            "ArrayAssignmentTarget",
            "AssignmentTargetWithDefault",
        ],
    },
    NodeDef {
        name: "AssignmentTargetWithDefault",
        fields: &[
            f("binding", "AssignmentTarget", Cardinality::One),
            f("init", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentTargetProperty",
        fields: &[],
        variants: &[
            "AssignmentTargetPropertyIdentifier",
            "AssignmentTargetPropertyProperty",
        ],
    },
    NodeDef {
        name: "AssignmentTargetPropertyIdentifier",
        fields: &[f("init", "Expression", Cardinality::Opt)],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentTargetPropertyProperty",
        fields: &[
            f("name", "PropertyKey", Cardinality::One),
            f("binding", "AssignmentTargetMaybeDefault", Cardinality::One),
        ],
        variants: &[],
    },
    // ===== binding patterns =====
    NodeDef {
        name: "BindingPattern",
        fields: &[f("kind", "BindingPatternKind", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "BindingPatternKind",
        fields: &[],
        variants: &[
            "BindingIdentifier",
            "ObjectPattern",
            "ArrayPattern",
            "AssignmentPattern",
        ],
    },
    NodeDef {
        name: "ObjectPattern",
        fields: &[
            f("properties", "BindingProperty", Cardinality::Vec),
            f("rest", "BindingRestElement", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ArrayPattern",
        fields: &[
            f("elements", "BindingPattern", Cardinality::Vec),
            f("rest", "BindingRestElement", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "AssignmentPattern",
        fields: &[
            f("left", "BindingPattern", Cardinality::One),
            f("right", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "BindingProperty",
        fields: &[
            f("key", "PropertyKey", Cardinality::One),
            f("value", "BindingPattern", Cardinality::One),
        ],
        variants: &[],
    },
    // ===== statements =====
    NodeDef {
        name: "Statement",
        fields: &[],
        variants: &[
            // Ordered so that BFS for the snippet generator picks the most
            // readable witness path first.
            "ExpressionStatement",
            "BlockStatement",
            "IfStatement",
            "ReturnStatement",
            "ThrowStatement",
            "WhileStatement",
            "DoWhileStatement",
            "ForStatement",
            "ForInStatement",
            "ForOfStatement",
            "SwitchStatement",
            "LabeledStatement",
            "TryStatement",
            "WithStatement",
            "VariableDeclaration",
            "FunctionDeclaration",
            "ClassDeclaration",
            "ImportDeclaration",
            "ExportAllDeclaration",
            "ExportDefaultDeclaration",
            "ExportNamedDeclaration",
            "BreakStatement",
            "ContinueStatement",
            "DebuggerStatement",
            "EmptyStatement",
        ],
    },
    NodeDef {
        name: "BlockStatement",
        fields: &[f("body", "Statement", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "BreakStatement",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "ContinueStatement",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "DebuggerStatement",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "EmptyStatement",
        fields: &[],
        variants: &[],
    },
    NodeDef {
        name: "ExpressionStatement",
        fields: &[f("expression", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "IfStatement",
        fields: &[
            f("test", "Expression", Cardinality::One),
            f("consequent", "Statement", Cardinality::One),
            f("alternate", "Statement", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "DoWhileStatement",
        fields: &[
            f("body", "Statement", Cardinality::One),
            f("test", "Expression", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "WhileStatement",
        fields: &[
            f("test", "Expression", Cardinality::One),
            f("body", "Statement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ForStatement",
        fields: &[
            f("init", "ForStatementInit", Cardinality::Opt),
            f("test", "Expression", Cardinality::Opt),
            f("update", "Expression", Cardinality::Opt),
            f("body", "Statement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ForStatementInit",
        fields: &[],
        variants: &["VariableDeclaration", "Expression"],
    },
    NodeDef {
        name: "ForInStatement",
        fields: &[
            f("left", "ForStatementLeft", Cardinality::One),
            f("right", "Expression", Cardinality::One),
            f("body", "Statement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ForOfStatement",
        fields: &[
            f("left", "ForStatementLeft", Cardinality::One),
            f("right", "Expression", Cardinality::One),
            f("body", "Statement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ForStatementLeft",
        fields: &[],
        // AssignmentTarget first so the snippet generator produces a valid
        // for-of/for-in left (the VariableDeclaration template carries a
        // trailing `;` and would render `for(var x=…; of …)` which is
        // invalid syntax).
        variants: &["AssignmentTarget", "VariableDeclaration"],
    },
    NodeDef {
        name: "LabeledStatement",
        fields: &[f("body", "Statement", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ReturnStatement",
        fields: &[f("argument", "Expression", Cardinality::Opt)],
        variants: &[],
    },
    NodeDef {
        name: "SwitchStatement",
        fields: &[
            f("discriminant", "Expression", Cardinality::One),
            f("cases", "SwitchCase", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "SwitchCase",
        fields: &[
            f("test", "Expression", Cardinality::Opt),
            f("consequent", "Statement", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ThrowStatement",
        fields: &[f("argument", "Expression", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "TryStatement",
        fields: &[
            f("block", "BlockStatement", Cardinality::One),
            f("handler", "CatchClause", Cardinality::Opt),
            f("finalizer", "BlockStatement", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "CatchClause",
        fields: &[
            f("param", "CatchParameter", Cardinality::Opt),
            f("body", "BlockStatement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "CatchParameter",
        fields: &[f("pattern", "BindingPattern", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "WithStatement",
        fields: &[
            f("object", "Expression", Cardinality::One),
            f("body", "Statement", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "VariableDeclaration",
        fields: &[f("declarations", "VariableDeclarator", Cardinality::Vec)],
        variants: &[],
    },
    NodeDef {
        name: "VariableDeclarator",
        fields: &[
            f("id", "BindingPattern", Cardinality::One),
            f("init", "Expression", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "FunctionDeclaration",
        fields: &[
            f("id", "BindingIdentifier", Cardinality::Opt),
            f("params", "FormalParameters", Cardinality::One),
            f("body", "FunctionBody", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ClassDeclaration",
        fields: &[f("body", "ClassBody", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ImportDeclaration",
        fields: &[
            f("source", "StringLiteral", Cardinality::One),
            f("specifiers", "ImportDeclarationSpecifier", Cardinality::Vec),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ImportDeclarationSpecifier",
        fields: &[],
        variants: &[
            "ImportSpecifier",
            "ImportDefaultSpecifier",
            "ImportNamespaceSpecifier",
        ],
    },
    NodeDef {
        name: "ImportSpecifier",
        fields: &[f("local", "BindingIdentifier", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ImportDefaultSpecifier",
        fields: &[f("local", "BindingIdentifier", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ImportNamespaceSpecifier",
        fields: &[f("local", "BindingIdentifier", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ExportAllDeclaration",
        fields: &[f("source", "StringLiteral", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ExportDefaultDeclaration",
        fields: &[f("declaration", "ExportDefaultDeclarationKind", Cardinality::One)],
        variants: &[],
    },
    NodeDef {
        name: "ExportDefaultDeclarationKind",
        fields: &[],
        variants: &[
            "FunctionDeclaration",
            "ClassDeclaration",
            "Expression",
        ],
    },
    NodeDef {
        name: "ExportNamedDeclaration",
        fields: &[
            f("declaration", "Declaration", Cardinality::Opt),
            f("specifiers", "ExportSpecifier", Cardinality::Vec),
            f("source", "StringLiteral", Cardinality::Opt),
        ],
        variants: &[],
    },
    NodeDef {
        name: "Declaration",
        fields: &[],
        variants: &[
            "VariableDeclaration",
            "FunctionDeclaration",
            "ClassDeclaration",
        ],
    },
    NodeDef {
        name: "ExportSpecifier",
        fields: &[
            f("local", "ModuleExportName", Cardinality::One),
            f("exported", "ModuleExportName", Cardinality::One),
        ],
        variants: &[],
    },
    NodeDef {
        name: "ModuleExportName",
        fields: &[],
        variants: &[
            "IdentifierName",
            "IdentifierReference",
            "StringLiteral",
        ],
    },
];

pub fn lookup(name: &str) -> Option<&'static NodeDef> {
    NODES.iter().find(|n| n.name == name)
}
