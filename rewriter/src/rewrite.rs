use oxc_allocator::Allocator;
use oxc_ast::{
	ast::{AssignmentTarget, Expression, IdentifierReference, ObjectPropertyKind},
	visit::walk,
	Visit,
};
use oxc_parser::Parser;
use oxc_span::{Atom, SourceType, Span};
use oxc_syntax::operator::{AssignmentOperator, UnaryOperator};
use url::Url;

#[derive(Debug)]
enum JsChange {
	GenericChange {
		span: Span,
		text: String,
	},
	DebugInject {
		span: Span,
	},
	Assignment {
		name: String,
		entirespan: Span,
		rhsspan: Span,
		op: AssignmentOperator,
	},
}

pub type EncodeFn = Box<dyn Fn(String) -> String>;
struct Rewriter {
	jschanges: Vec<JsChange>,
	base: Url,
	config: Config,
}

pub struct Config {
	pub prefix: String,
	pub wrapfn: String,
	pub importfn: String,
	pub rewritefn: String,
	pub encode: EncodeFn,
}

impl Rewriter {
	fn rewrite_url(&mut self, url: String) -> String {
		let url = self.base.join(&url).unwrap();

		let urlencoded = (self.config.encode)(url.to_string());

		format!("\"{}{}\"", self.config.prefix, urlencoded)
	}

	fn rewrite_ident(&mut self, name: &Atom, span: Span) {
		if UNSAFE_GLOBALS.contains(&name.to_string().as_str()) {
			self.jschanges.push(JsChange::GenericChange {
				span,
				text: format!("({}({}))", self.config.wrapfn, name),
			});
		}
	}
}

impl<'a> Visit<'a> for Rewriter {
	fn visit_identifier_reference(&mut self, it: &IdentifierReference<'a>) {
		// self.jschanges.push(JsChange::GenericChange {
		//     span: it.span,
		//     text: format!(
		//         "({}(typeof {} == 'undefined' || {}, (()=>{{ try {{return arguments}} catch(_){{}} }})()))",
		//         self.wrapfn, it.name, it.name
		//     ),
		// });
		if UNSAFE_GLOBALS.contains(&it.name.to_string().as_str()) {
			self.jschanges.push(JsChange::GenericChange {
				span: it.span,
				text: format!("{}({})", self.config.wrapfn, it.name),
			});
		}
	}

	// we need to rewrite `new Something` to `new (wrapfn(Something))` instead of `new wrapfn(Something)`, that's why there's weird extra code here
	fn visit_new_expression(&mut self, it: &oxc_ast::ast::NewExpression<'a>) {
		match &it.callee {
			Expression::Identifier(s) => {
				self.rewrite_ident(&s.name, s.span);
				return;
			}
			Expression::StaticMemberExpression(s) => match &s.object {
				Expression::Identifier(s) => {
					self.rewrite_ident(&s.name, s.span);
					return;
				}
				_ => {}
			},
			Expression::ComputedMemberExpression(s) => match &s.object {
				Expression::Identifier(s) => {
					self.rewrite_ident(&s.name, s.span);
					return;
				}
				_ => {}
			},
			_ => {}
		}
		walk::walk_new_expression(self, it);
	}
	fn visit_this_expression(&mut self, it: &oxc_ast::ast::ThisExpression) {
		self.jschanges.push(JsChange::GenericChange {
			span: it.span,
			text: format!("{}(this)", self.config.wrapfn),
		});
	}

	fn visit_debugger_statement(&mut self, it: &oxc_ast::ast::DebuggerStatement) {
		// delete debugger statements entirely. some sites will spam debugger as an anti-debugging measure, and we don't want that!
		self.jschanges.push(JsChange::GenericChange {
			span: it.span,
			text: "".to_string(),
		});
	}

	// we can't overwrite window.eval in the normal way because that would make everything an
	// indirect eval, which could break things. we handle that edge case here
	fn visit_call_expression(&mut self, it: &oxc_ast::ast::CallExpression<'a>) {
		if let Expression::Identifier(s) = &it.callee {
			// if it's optional that actually makes it an indirect eval which is handled separately
			if s.name == "eval" && !it.optional {
				self.jschanges.push(JsChange::GenericChange {
					span: Span::new(s.span.start, s.span.end + 1),
					text: format!("eval({}(", self.config.rewritefn),
				});
				self.jschanges.push(JsChange::GenericChange {
					span: Span::new(it.span.end, it.span.end),
					text: ")".to_string(),
				});

				// then we walk the arguments, but not the callee, since we want it to resolve to
				// the real eval
				walk::walk_arguments(self, &it.arguments);
				return;
			}
		}
		walk::walk_call_expression(self, it);
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
			text: format!("({}(\"{}\"))", self.config.importfn, self.base),
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
		// do not walk further, we don't want to rewrite the identifiers
	}

	#[cfg(feature = "debug")]
	fn visit_try_statement(&mut self, it: &oxc_ast::ast::TryStatement<'a>) {
		// for debugging we need to know what the error was

		if let Some(h) = &it.handler {
			if let Some(name) = &h.param {
				if let Some(name) = name.pattern.get_identifier() {
					self.jschanges.push(JsChange::GenericChange {
						span: Span::new(h.body.span.start + 1, h.body.span.start + 1),
						text: format!("$scramerr({});", name),
					});
				}
			}
		}
		walk::walk_try_statement(self, it);
	}

	fn visit_object_expression(&mut self, it: &oxc_ast::ast::ObjectExpression<'a>) {
		for prop in &it.properties {
			#[allow(clippy::single_match)]
			match prop {
				ObjectPropertyKind::ObjectProperty(p) => match &p.value {
					Expression::Identifier(s) => {
						if UNSAFE_GLOBALS.contains(&s.name.to_string().as_str()) && p.shorthand {
							self.jschanges.push(JsChange::GenericChange {
								span: s.span,
								text: format!("{}: ({}({}))", s.name, self.config.wrapfn, s.name),
							});
							return;
						}
					}
					_ => {}
				},
				_ => {}
			}
		}

		walk::walk_object_expression(self, it);
	}

	fn visit_return_statement(&mut self, it: &oxc_ast::ast::ReturnStatement<'a>) {
		// if let Some(arg) = &it.argument {
		// 	self.jschanges.push(JsChange::GenericChange {
		// 		span: Span::new(it.span.start + 6, it.span.start + 6),
		// 		text: format!(" $scramdbg((()=>{{ try {{return arguments}} catch(_){{}} }})(),("),
		// 	});
		// 	self.jschanges.push(JsChange::GenericChange {
		// 		span: Span::new(expression_span(arg).end, expression_span(arg).end),
		// 		text: format!("))"),
		// 	});
		// }
		walk::walk_return_statement(self, it);
	}

	fn visit_unary_expression(&mut self, it: &oxc_ast::ast::UnaryExpression<'a>) {
		if matches!(it.operator, UnaryOperator::Typeof) {
			// don't walk to identifier rewrites since it won't matter
			return;
		}
		walk::walk_unary_expression(self, it);
	}

	// we don't want to rewrite the identifiers here because of a very specific edge case
	fn visit_for_in_statement(&mut self, it: &oxc_ast::ast::ForInStatement<'a>) {
		walk::walk_statement(self, &it.body);
	}
	fn visit_for_of_statement(&mut self, it: &oxc_ast::ast::ForOfStatement<'a>) {
		walk::walk_statement(self, &it.body);
	}

	fn visit_update_expression(&mut self, _it: &oxc_ast::ast::UpdateExpression<'a>) {
		// then no, don't walk it, we don't care
	}

	fn visit_assignment_expression(&mut self, it: &oxc_ast::ast::AssignmentExpression<'a>) {
		#[allow(clippy::single_match)]
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
			AssignmentTarget::ArrayAssignmentTarget(_) => {
				// [location] = ["https://example.com"]
				// this is such a ridiculously specific edge case. just ignore it
				return;
			}
			_ => {
				// only walk the left side if it isn't an identifier, we can't replace the
				// identifier with a function obviously
				walk::walk_assignment_target(self, &it.left);
			}
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
const UNSAFE_GLOBALS: [&str; 9] = [
	"window",
	"self",
	"globalThis",
	"this",
	"parent",
	"top",
	"location",
	"document",
	"eval",
];

pub fn rewrite(js: &str, url: Url, config: Config) -> Vec<u8> {
	let allocator = Allocator::default();
	let source_type = SourceType::default();
	let ret = Parser::new(&allocator, js, source_type).parse();

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
		config,
	};

	ast_pass.visit_program(&program);

	// sorrt changse
	ast_pass.jschanges.sort_by(|a, b| {
		let a = match a {
			JsChange::GenericChange { span, text: _ } => span.start,
			JsChange::Assignment {
				name: _,
				entirespan,
				rhsspan: _,
				op: _,
			} => entirespan.start,
			JsChange::DebugInject { span } => span.start,
		};
		let b = match b {
			JsChange::GenericChange { span, text: _ } => span.start,
			JsChange::Assignment {
				name: _,
				entirespan,
				rhsspan: _,
				op: _,
			} => entirespan.start,
			JsChange::DebugInject { span } => span.start,
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
				rhsspan: _,
				op: _,
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

				buffer.extend_from_slice(unsafe { js.get_unchecked(offset..start) }.as_bytes());

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
				buffer.extend_from_slice(js[offset..start].as_bytes());

				buffer.extend_from_slice(
					format!(
						"((t)=>$scramjet$tryset({},\"{}\",t)||{}{}t)({})",
						name,
						fmt_op(*op),
						name,
						fmt_op(*op),
						&js[rhsspan.start as usize..rhsspan.end as usize]
					)
					.as_bytes(),
				);

				offset = entirespan.end as usize;
			}
			JsChange::DebugInject { span } => {
				let start = span.start as usize;
				buffer.extend_from_slice(unsafe { js.get_unchecked(offset..start) }.as_bytes());

				offset = span.end as usize;
			}
		}
	}
	buffer.extend_from_slice(js[offset..].as_bytes());

	buffer
}

fn fmt_op(op: AssignmentOperator) -> &'static str {
	match op {
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
	}
}
