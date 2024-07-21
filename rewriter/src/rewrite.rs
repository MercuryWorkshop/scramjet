use oxc_allocator::Allocator;
use oxc_ast::{
    ast::{
        AssignmentTarget, Class, Expression, Function, IdentifierReference, MemberExpression,
        ObjectExpression, ObjectProperty, ObjectPropertyKind, TSImportType,
    },
    visit::walk,
    Visit,
};
use oxc_parser::Parser;
use oxc_span::{SourceType, Span};
use oxc_syntax::{operator::AssignmentOperator, scope::ScopeFlags};
use url::Url;
use urlencoding::encode;

#[derive(Debug)]
enum JsChange {
    GenericChange {
        span: Span,
        text: String,
    },
    UrlRewrite {
        span: Span,
        url: String,
    },
    Assignment {
        name: String,
        entirespan: Span,
        rhsspan: Span,
        op: AssignmentOperator,
    },
}

#[derive(Debug)]
struct Rewriter {
    jschanges: Vec<JsChange>,
    base: Url,
}
impl Rewriter {
    fn rewrite_url(&mut self, url: String) -> String {
        let url = self.base.join(&url).unwrap();

        let urlencoded = encode(url.as_str());

        return format!("\"/scramjet/{}\"", urlencoded);
    }
}

impl<'a> Visit<'a> for Rewriter {
    fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
        if UNSAFE_GLOBALS.contains(&it.name.to_string().as_str()) {
            self.jschanges.push(JsChange::GenericChange {
                span: it.span,
                text: format!("(globalThis.$s({}))", it.name),
            });
        }
    }
    fn visit_this_expression(&mut self, it: &oxc_ast::ast::ThisExpression) {
        self.jschanges.push(JsChange::GenericChange {
            span: it.span,
            text: "(globalThis.$s(this))".to_string(),
        });
    }

    fn visit_import_declaration(&mut self, it: &oxc_ast::ast::ImportDeclaration<'a>) {
        let name = it.source.value.to_string();
        let text = self.rewrite_url(name);
        self.jschanges.push(JsChange::GenericChange {
            span: it.source.span,
            text,
        });
        walk::walk_import_declaration(self, it);
    }
    fn visit_import_expression(&mut self, it: &oxc_ast::ast::ImportExpression<'a>) {
        self.jschanges.push(JsChange::GenericChange {
            span: Span::new(it.span.start, it.span.start + 6),
            text: format!("(globalThis.$sImport(\"{}\"))", self.base),
        });
        walk::walk_import_expression(self, it);
    }

    fn visit_export_all_declaration(&mut self, it: &oxc_ast::ast::ExportAllDeclaration<'a>) {
        let name = it.source.value.to_string();
        let text = self.rewrite_url(name);
        self.jschanges.push(JsChange::GenericChange {
            span: it.source.span,
            text,
        });
    }

    fn visit_export_named_declaration(&mut self, it: &oxc_ast::ast::ExportNamedDeclaration<'a>) {
        if let Some(source) = &it.source {
            let name = source.value.to_string();
            let text = self.rewrite_url(name);
            self.jschanges.push(JsChange::GenericChange {
                span: source.span,
                text,
            });
        }
        walk::walk_export_named_declaration(self, it);
    }

    fn visit_object_expression(&mut self, it: &oxc_ast::ast::ObjectExpression<'a>) {
        for prop in &it.properties {
            match prop {
                ObjectPropertyKind::ObjectProperty(p) => match &p.value {
                    Expression::Identifier(s) => {
                        if UNSAFE_GLOBALS.contains(&s.name.to_string().as_str()) {
                            if p.shorthand {
                                self.jschanges.push(JsChange::GenericChange {
                                    span: s.span,
                                    text: format!("{}: (globalThis.$s({}))", s.name, s.name),
                                });
                                return;
                            }
                        }
                    }
                    _ => {}
                },
                _ => {}
            }
        }

        walk::walk_object_expression(self, it);
    }

    fn visit_assignment_expression(&mut self, it: &oxc_ast::ast::AssignmentExpression<'a>) {
        match &it.left {
            AssignmentTarget::AssignmentTargetIdentifier(s) => {
                if ["location"].contains(&s.name.to_string().as_str()) {
                    self.jschanges.push(JsChange::Assignment {
                        name: s.name.to_string(),
                        entirespan: it.span,
                        rhsspan: expression_span(&it.right),
                        op: it.operator,
                    });

                    // avoid walking rest of tree, i would need to figure out nested rewrites
                    // somehow
                    return;
                }
            }
            _ => {}
        }
        walk::walk_expression(self, &it.right);
    }
}

fn expression_span(e: &Expression) -> Span {
    // enums.split("\n").filter(f=>f).map(p=>p.trimLeft()).filter(p=>!p.startsWith("#")).map(p=>p.replace(/\(.*/,"")).map(p=>`E::${p}(s) => s.span`).join(",\n")
    use Expression as E;
    match e {
        E::BooleanLiteral(s) => s.span,
        E::NullLiteral(s) => s.span,
        E::NumericLiteral(s) => s.span,
        E::BigIntLiteral(s) => s.span,
        E::RegExpLiteral(s) => s.span,
        E::StringLiteral(s) => s.span,
        E::TemplateLiteral(s) => s.span,
        E::Identifier(s) => s.span,
        E::MetaProperty(s) => s.span,
        E::Super(s) => s.span,
        E::ArrayExpression(s) => s.span,
        E::ArrowFunctionExpression(s) => s.span,
        E::AssignmentExpression(s) => s.span,
        E::AwaitExpression(s) => s.span,
        E::BinaryExpression(s) => s.span,
        E::CallExpression(s) => s.span,
        E::ChainExpression(s) => s.span,
        E::ClassExpression(s) => s.span,
        E::ConditionalExpression(s) => s.span,
        E::FunctionExpression(s) => s.span,
        E::ImportExpression(s) => s.span,
        E::LogicalExpression(s) => s.span,
        E::NewExpression(s) => s.span,
        E::ObjectExpression(s) => s.span,
        E::ParenthesizedExpression(s) => s.span,
        E::SequenceExpression(s) => s.span,
        E::TaggedTemplateExpression(s) => s.span,
        E::ThisExpression(s) => s.span,
        E::UnaryExpression(s) => s.span,
        E::UpdateExpression(s) => s.span,
        E::YieldExpression(s) => s.span,
        E::PrivateInExpression(s) => s.span,
        E::JSXElement(s) => s.span,
        E::JSXFragment(s) => s.span,
        E::TSAsExpression(s) => s.span,
        E::TSSatisfiesExpression(s) => s.span,
        E::TSTypeAssertion(s) => s.span,
        E::TSNonNullExpression(s) => s.span,
        E::TSInstantiationExpression(s) => s.span,
        E::ComputedMemberExpression(s) => s.span,
        E::StaticMemberExpression(s) => s.span,
        E::PrivateFieldExpression(s) => s.span,
    }
}

// js MUST not be able to get a reference to any of these because sbx
const UNSAFE_GLOBALS: [&str; 8] = [
    "window",
    "self",
    "globalThis",
    "this",
    "parent",
    "top",
    "location",
    "document",
];

pub fn rewrite(js: &str, url: Url) -> Vec<u8> {
    let allocator = Allocator::default();
    let source_type = SourceType::default();
    let ret = Parser::new(&allocator, &js, source_type).parse();

    for error in ret.errors {
        let cloned = js.to_string();
        let error = error.with_source_code(cloned);
        println!("{error:?}");
    }

    let program = ret.program;

    // dbg!(&program);

    let mut ast_pass = Rewriter {
        jschanges: Vec::new(),
        base: url,
    };

    ast_pass.visit_program(&program);

    // sorrt changse
    ast_pass.jschanges.sort_by(|a, b| {
        let a = match a {
            JsChange::GenericChange { span, text } => span.start,
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
                op,
            } => entirespan.start,
            _ => 0,
        };
        let b = match b {
            JsChange::GenericChange { span, text } => span.start,
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
                op,
            } => entirespan.start,
            _ => 0,
        };
        a.cmp(&b)
    });

    let original_len = js.len();
    let mut difference = 0i32;

    for change in &ast_pass.jschanges {
        match &change {
            JsChange::GenericChange { span, text } => {
                difference += text.len() as i32 - (span.end - span.start) as i32;
            }
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
                op,
            } => difference += entirespan.size() as i32 + name.len() as i32 + 10,
            _ => {}
        }
    }

    let size_estimate = (original_len as i32 + difference) as usize;
    let mut buffer: Vec<u8> = Vec::with_capacity(size_estimate);

    let mut offset = 0;
    for change in ast_pass.jschanges {
        match &change {
            JsChange::GenericChange { span, text } => {
                let start = span.start as usize;
                let end = span.end as usize;

                buffer.extend_from_slice(unsafe { js.slice_unchecked(offset, start) }.as_bytes());

                buffer.extend_from_slice(text.as_bytes());
                offset = end;
            }
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
                op,
            } => {
                let start = entirespan.start as usize;
                buffer.extend_from_slice(&js[offset..start].as_bytes());

                let opstr = match op {
                    AssignmentOperator::Assign => "=",
                    AssignmentOperator::Addition => "+=",
                    AssignmentOperator::Subtraction => "-=",
                    AssignmentOperator::Multiplication => "*=",
                    AssignmentOperator::Division => "/=",
                    AssignmentOperator::Remainder => "%=",
                    AssignmentOperator::Exponential => "**=",
                    AssignmentOperator::ShiftLeft => "<<=",
                    AssignmentOperator::ShiftRight => ">>=",
                    AssignmentOperator::ShiftRightZeroFill => ">>>=",
                    AssignmentOperator::BitwiseAnd => "&=",
                    AssignmentOperator::BitwiseXOR => "^=",
                    AssignmentOperator::BitwiseOR => "|=",
                    AssignmentOperator::LogicalAnd => "&&=",
                    AssignmentOperator::LogicalOr => "||=",
                    AssignmentOperator::LogicalNullish => "??=",
                };

                buffer.extend_from_slice(
                    format!(
                        "((t)=>$tryset({},\"{}\",t)||{}=t)({})",
                        name,
                        opstr,
                        name,
                        &js[rhsspan.start as usize..rhsspan.end as usize]
                    )
                    .as_bytes(),
                );

                offset = entirespan.end as usize;
            }
            _ => {}
        }
    }
    buffer.extend_from_slice(js[offset..].as_bytes());

    return buffer;
}
