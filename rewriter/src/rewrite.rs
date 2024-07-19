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

    let original_len = js.len();
    let mut difference = 0i32;

    for change in &ast_pass.jschanges {
        match &change {
            JsChange::GenericChange { span, text } => {
                difference += text.len() as i32 - (span.end - span.start) as i32;
            }
            _ => {}
        }
    }

    let size_estimate = (original_len as i32 + difference) as usize;
    let mut buffer: Vec<u8> = Vec::with_capacity(size_estimate);

    let mut offset = 0;
    for change in ast_pass.jschanges {
        match &change {
            JsChange::GenericChange { span, text } => {
                let len = (span.end - span.start) as usize;
                let start = span.start as usize;
                let end = span.end as usize;

                buffer.extend_from_slice(unsafe { js.slice_unchecked(offset, start) }.as_bytes());

                buffer.extend_from_slice(text.as_bytes());
                offset = end;

                // offset = (offset as i64 + (text.len() as i64 - len as i64)) as usize;
            }
            _ => {}
        }
    }
    buffer.extend_from_slice(js[offset..].as_bytes());

    return buffer;
}
