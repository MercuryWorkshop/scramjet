use oxc_allocator::Allocator;
use oxc_ast::{
    ast::{AssignmentTarget, Class, Function, IdentifierReference, MemberExpression, TSImportType},
    visit::walk,
    Visit,
};
use oxc_parser::Parser;
use oxc_span::{SourceType, Span};
use oxc_syntax::scope::ScopeFlags;

#[derive(Debug)]
enum JsChange {
    GenericChange {
        span: Span,
        text: String,
    },
    Assignment {
        name: String,
        entirespan: Span,
        rhsspan: Span,
    },
}

#[derive(Debug, Default)]
struct Rewriter {
    jschanges: Vec<JsChange>,
}

impl<'a> Visit<'a> for Rewriter {
    // fn visit_assignment_expression(&mut self, expr: &oxc_ast::ast::AssignmentExpression<'a>) {
    //     if expr.left.is_simple_assignment_target() {
    //         let name = expr
    //             .left
    //             .as_simple_assignment_target()
    //             .unwrap()
    //             .get_identifier()
    //             .unwrap();
    //         if name == "location" {
    //             use oxc_ast::ast::Expression as E;
    //             let span = match &expr.right {
    //                 E::Super(s) => s.span,
    //                 E::ThisExpression(s) => s.span,
    //                 E::Identifier(s) => s.span,
    //                 E::NumericLiteral(s) => s.span,
    //                 E::AssignmentExpression(s) => s.span,
    //
    //                 _ => todo!("{:?}", expr.right),
    //             };
    //             self.jschanges.push(JsChange::Assignment {
    //                 name: name.to_string(),
    //                 entirespan: expr.span,
    //                 rhsspan: span,
    //             });
    //         }
    //     }
    // }
    fn visit_member_expression(&mut self, it: &MemberExpression<'a>) {
        match it {
            MemberExpression::StaticMemberExpression(s) => {
                if s.property.name.to_string() == "location" {
                    self.jschanges.push(JsChange::GenericChange {
                        span: s.property.span,
                        text: "_location".to_string(),
                    });
                }
            }
            _ => {}
        }
    }
}
pub fn rewrite(js: &str) -> String {
    let source_text = js.to_string();
    let allocator = Allocator::default();
    let source_type = SourceType::default();
    let ret = Parser::new(&allocator, &source_text, source_type).parse();

    for error in ret.errors {
        let error = error.with_source_code(source_text.clone());
        println!("{error:?}");
    }

    let program = ret.program;

    let mut ast_pass = Rewriter::default();
    ast_pass.visit_program(&program);

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
        }
    }
    return rewritten;
}
