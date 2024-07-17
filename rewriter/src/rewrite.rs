use oxc_allocator::Allocator;
use oxc_ast::{
    ast::{
        AssignmentTarget, Class, Expression, Function, IdentifierReference, MemberExpression,
        TSImportType,
    },
    visit::walk,
    Visit,
};
use oxc_parser::Parser;
use oxc_span::{SourceType, Span};
use oxc_syntax::scope::ScopeFlags;
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
    },
}

#[derive(Debug)]
struct Rewriter {
    jschanges: Vec<JsChange>,
    base: Url,
}

impl<'a> Visit<'a> for Rewriter {
    fn visit_assignment_expression(&mut self, expr: &oxc_ast::ast::AssignmentExpression<'a>) {
        // if expr.left.is_simple_assignment_target() {
        //     let name = expr
        //         .left
        //         .as_simple_assignment_target()
        //         .unwrap()
        //         .get_identifier()
        //         .unwrap();
        //     if name == "location" {
        //         use oxc_ast::ast::Expression as E;
        //         let span = match &expr.right {
        //             E::Super(s) => s.span,
        //             E::ThisExpression(s) => s.span,
        //             E::Identifier(s) => s.span,
        //             E::NumericLiteral(s) => s.span,
        //             E::AssignmentExpression(s) => s.span,
        //
        //             _ => todo!("{:?}", expr.right),
        //         };
        //         self.jschanges.push(JsChange::Assignment {
        //             name: name.to_string(),
        //             entirespan: expr.span,
        //             rhsspan: span,
        //         });
        //     }
        // }

        match &expr.right {
            Expression::Identifier(s) => {
                if UNSAFE_GLOBALS.contains(&s.name.to_string().as_str()) {
                    self.jschanges.push(JsChange::GenericChange {
                        span: s.span,
                        text: format!("(globalThis.$s({}))", s.name),
                    });
                }
            }
            _ => {
                walk::walk_assignment_expression(self, expr);
            }
        }
    }
    fn visit_import_declaration(&mut self, it: &oxc_ast::ast::ImportDeclaration<'a>) {
        let name = it.source.value.to_string();
        let url = self.base.join(&name).unwrap();

        let urlencoded = encode(url.as_str());

        self.jschanges.push(JsChange::GenericChange {
            span: it.source.span,
            text: format!("\"/scramjet/{}\"", urlencoded),
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
    fn visit_variable_declarator(&mut self, it: &oxc_ast::ast::VariableDeclarator<'a>) {
        match &it.init {
            Some(Expression::Identifier(s)) => {
                if UNSAFE_GLOBALS.contains(&s.name.to_string().as_str()) {
                    self.jschanges.push(JsChange::GenericChange {
                        span: s.span,
                        text: format!("(globalThis.$s({}))", s.name),
                    });
                }
            }
            _ => {
                walk::walk_variable_declarator(self, it);
            }
        }
    }

    fn visit_member_expression(&mut self, it: &MemberExpression<'a>) {
        self.trace_member(it);
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

impl Rewriter {
    fn trace_member<'a>(&mut self, it: &MemberExpression<'a>) {
        match &it {
            MemberExpression::StaticMemberExpression(s) => match &s.object {
                Expression::Identifier(obj) => {
                    if UNSAFE_GLOBALS.contains(&obj.name.to_string().as_str()) {
                        self.jschanges.push(JsChange::GenericChange {
                            span: obj.span,
                            text: format!("(globalThis.$s({}))", obj.name),
                        });
                    }
                }
                Expression::ThisExpression(obj) => {
                    self.jschanges.push(JsChange::GenericChange {
                        span: obj.span,
                        text: "(globalThis.$s(this))".to_string(),
                    });
                }
                _ => {
                    if it.object().is_member_expression() {
                        self.trace_member(it.object().as_member_expression().unwrap());
                    } else {
                        walk::walk_member_expression(self, it);
                    }
                }
            },
            MemberExpression::ComputedMemberExpression(s) => match &s.object {
                Expression::Identifier(obj) => {
                    if UNSAFE_GLOBALS.contains(&obj.name.to_string().as_str()) {
                        self.jschanges.push(JsChange::GenericChange {
                            span: obj.span,
                            text: format!("(globalThis.$s({}))", obj.name),
                        });
                    }
                }
                Expression::ThisExpression(obj) => {
                    self.jschanges.push(JsChange::GenericChange {
                        span: obj.span,
                        text: "(globalThis.$s(this))".to_string(),
                    });
                }
                _ => {
                    if it.object().is_member_expression() {
                        self.trace_member(it.object().as_member_expression().unwrap());
                    } else {
                        walk::walk_member_expression(self, it);
                    }
                }
            },
            _ => {}
        }
    }
}

pub fn rewrite(js: &str, url: Url) -> String {
    let source_text = js.to_string();
    let allocator = Allocator::default();
    let source_type = SourceType::default();
    let ret = Parser::new(&allocator, &source_text, source_type).parse();

    for error in ret.errors {
        let error = error.with_source_code(source_text.clone());
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
            } => entirespan.start,
            _ => 0,
        };
        let b = match b {
            JsChange::GenericChange { span, text } => span.start,
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
            } => entirespan.start,
            _ => 0,
        };
        a.cmp(&b)
    });

    let mut rewritten = source_text.clone();
    let mut offset = 0;
    for change in ast_pass.jschanges {
        match &change {
            JsChange::GenericChange { span, text } => {
                let len = (span.end - span.start) as usize;
                let start = span.start as usize + offset;
                let end = span.end as usize + offset;
                rewritten.replace_range(start..end, &text);

                offset = (offset as i64 + (text.len() as i64 - len as i64)) as usize;
            }
            JsChange::Assignment {
                name,
                entirespan,
                rhsspan,
            } => {
                let len = (entirespan.end - entirespan.start) as usize;
                let start = entirespan.start as usize + offset;
                let end = entirespan.end as usize + offset;

                let text = format!(
                    "$set({}, {})",
                    name,
                    &source_text[rhsspan.start as usize..rhsspan.end as usize]
                );
                rewritten.replace_range(start..end, &text);

                offset += text.len() - len;
            }
            _ => {}
        }
    }
    return rewritten;
}
