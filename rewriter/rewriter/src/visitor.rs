use oxc::{
	ast::{
		ast::{
			AssignmentExpression, AssignmentTarget, CallExpression, DebuggerStatement,
			ExportAllDeclaration, ExportNamedDeclaration, Expression, ForInStatement,
			ForOfStatement, FunctionBody, IdentifierReference, ImportDeclaration, ImportExpression,
			MemberExpression, MetaProperty, NewExpression, ObjectExpression, ObjectPropertyKind,
			ReturnStatement, ThisExpression, UnaryExpression, UnaryOperator, UpdateExpression,
		},
		visit::walk,
		Visit,
	},
	span::{Atom, GetSpan, Span},
};

use crate::{
	cfg::Config,
	changes::{JsChange, JsChanges},
};

// js MUST not be able to get a reference to any of these because sbx
//
// maybe move this out of this lib?
const UNSAFE_GLOBALS: &[&str] = &[
	"window",
	"self",
	"globalThis",
	"this",
	"parent",
	"top",
	"location",
	"document",
	"eval",
	"frames",
];

pub struct Visitor<E>
where
	E: Fn(String) -> String,
	E: Clone,
{
	pub jschanges: JsChanges,
	pub config: Config<E>,
}

impl<E> Visitor<E>
where
	E: Fn(String) -> String,
	E: Clone,
{
	fn rewrite_url(&mut self, url: String) -> String {
		let url = self.config.base.join(&url).unwrap();

		let urlencoded = (self.config.encoder)(url.to_string());

		format!("\"{}{}\"", self.config.prefix, urlencoded)
	}

	fn rewrite_ident(&mut self, name: &Atom, span: Span) {
		if UNSAFE_GLOBALS.contains(&name.as_str()) {
			self.jschanges.add(JsChange::WrapFn {
				span,
				ident: name.to_compact_str(),
				wrapped: true,
			});
		}
	}

	fn walk_member_expression(&mut self, it: &Expression) -> bool {
		if match it {
			Expression::Identifier(s) => {
				self.rewrite_ident(&s.name, s.span);
				true
			}
			Expression::StaticMemberExpression(s) => self.walk_member_expression(&s.object),
			Expression::ComputedMemberExpression(s) => self.walk_member_expression(&s.object),
			_ => false,
		} {
			return true;
		}
		// TODO: WE SHOULD PROBABLY WALK THE REST OF THE TREE
		// walk::walk_expression(self, it);
		false
	}

	fn scramitize(&mut self, span: Span) {
		self.jschanges.add(JsChange::Scramitize { span });
	}
}

impl<'a, E> Visit<'a> for Visitor<E>
where
	E: Fn(String) -> String,
	E: Clone,
{
	fn visit_identifier_reference(&mut self, it: &IdentifierReference) {
		// if self.config.capture_errors {
		// 	self.jschanges.insert(JsChange::GenericChange {
		// 		span: it.span,
		// 		text: format!(
		// 			"{}({}, typeof arguments != 'undefined' && arguments)",
		// 			self.config.wrapfn, it.name
		// 		),
		// 	});
		// } else {
		//
		if UNSAFE_GLOBALS.contains(&it.name.as_str()) {
			self.jschanges.add(JsChange::WrapFn {
				span: it.span,
				ident: it.name.to_compact_str(),
				wrapped: false,
			});
		}
		// }
	}

	// we need to rewrite `new Something` to `new (wrapfn(Something))` instead of `new wrapfn(Something)`, that's why there's weird extra code here
	fn visit_new_expression(&mut self, it: &NewExpression) {
		self.walk_member_expression(&it.callee);
		walk::walk_arguments(self, &it.arguments);
	}

	fn visit_member_expression(&mut self, it: &MemberExpression) {
		match it {
			MemberExpression::StaticMemberExpression(s) => {
				if s.property.name == "postMessage" {
					self.jschanges.add(JsChange::SetRealmFn {
						span: s.property.span,
						ident: s.property.name.to_compact_str(),
					});

					walk::walk_expression(self, &s.object);
					return; // unwise to walk the rest of the tree
				}

				if !self.config.strict_rewrites
					&& !UNSAFE_GLOBALS.contains(&s.property.name.as_str())
				{
					if let Expression::Identifier(_) = &s.object {
						// cull tree - this should be safe
						return;
					}
					if let Expression::ThisExpression(_) = &s.object {
						return;
					}
				}

				if self.config.scramitize
					&& !matches!(s.object, Expression::MetaProperty(_) | Expression::Super(_))
				{
					self.scramitize(s.object.span());
				}
			}
			_ => {
				// TODO
				// you could break this with ["postMessage"] etc
				// however this code only exists because of recaptcha whatever
				// and it would slow down js execution a lot
			}
		}

		walk::walk_member_expression(self, it);
	}
	fn visit_this_expression(&mut self, it: &ThisExpression) {
		self.jschanges.add(JsChange::WrapThisFn { span: it.span });
	}

	fn visit_debugger_statement(&mut self, it: &DebuggerStatement) {
		// delete debugger statements entirely. some sites will spam debugger as an anti-debugging measure, and we don't want that!
		self.jschanges.add(JsChange::Delete { span: it.span });
	}

	// we can't overwrite window.eval in the normal way because that would make everything an
	// indirect eval, which could break things. we handle that edge case here
	fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
		if let Expression::Identifier(s) = &it.callee {
			// if it's optional that actually makes it an indirect eval which is handled separately
			if s.name == "eval" && !it.optional {
				self.jschanges.add(JsChange::Eval {
					span: Span::new(it.span.start, it.span.end),
					inner: Span::new(s.span.end + 1, it.span.end),
				});

				// then we walk the arguments, but not the callee, since we want it to resolve to
				// the real eval
				walk::walk_arguments(self, &it.arguments);
				return;
			}
		}
		if self.config.scramitize {
			self.scramitize(it.span);
		}
		walk::walk_call_expression(self, it);
	}

	fn visit_import_declaration(&mut self, it: &ImportDeclaration<'a>) {
		let name = it.source.value.to_string();
		let text = self.rewrite_url(name);
		self.jschanges.add(JsChange::Replace {
			span: it.source.span,
			text,
		});
		walk::walk_import_declaration(self, it);
	}
	fn visit_import_expression(&mut self, it: &ImportExpression<'a>) {
		self.jschanges.add(JsChange::ImportFn {
			span: Span::new(it.span.start, it.span.start + 6),
		});
		walk::walk_import_expression(self, it);
	}

	fn visit_export_all_declaration(&mut self, it: &ExportAllDeclaration<'a>) {
		let name = it.source.value.to_string();
		let text = self.rewrite_url(name);
		self.jschanges.add(JsChange::Replace {
			span: it.source.span,
			text,
		});
	}
	fn visit_export_named_declaration(&mut self, it: &ExportNamedDeclaration<'a>) {
		if let Some(source) = &it.source {
			let name = source.value.to_string();
			let text = self.rewrite_url(name);
			self.jschanges.add(JsChange::Replace {
				span: source.span,
				text,
			});
		}
		// do not walk further, we don't want to rewrite the identifiers
	}

	#[cfg(feature = "debug")]
	fn visit_try_statement(&mut self, it: &oxc::ast::ast::TryStatement<'a>) {
		// for debugging we need to know what the error was

		if self.config.capture_errors {
			if let Some(h) = &it.handler {
				if let Some(name) = &h.param {
					if let Some(name) = name.pattern.get_identifier() {
						self.jschanges.add(JsChange::ScramErr {
							span: Span::new(h.body.span.start + 1, h.body.span.start + 1),
							name: name.to_compact_str(),
						});
					}
				}
			}
		}
		walk::walk_try_statement(self, it);
	}

	fn visit_object_expression(&mut self, it: &ObjectExpression<'a>) {
		for prop in &it.properties {
			if let ObjectPropertyKind::ObjectProperty(p) = prop {
				match &p.value {
					Expression::Identifier(s) => {
						if UNSAFE_GLOBALS.contains(&s.name.to_string().as_str()) && p.shorthand {
							self.jschanges.add(JsChange::ShorthandObj {
								span: s.span,
								name: s.name.to_compact_str(),
							});
							return;
						}
					}
					_ => {}
				}
			}
		}

		walk::walk_object_expression(self, it);
	}

	fn visit_function_body(&mut self, it: &FunctionBody<'a>) {
		// tag function for use in sourcemaps
		if self.config.do_sourcemaps {
			self.jschanges.add(JsChange::SourceTag {
				span: Span::new(it.span.start, it.span.start),
				tagname: it.span.start.to_string(),
			});
		}
		walk::walk_function_body(self, it);
	}

	fn visit_return_statement(&mut self, it: &ReturnStatement<'a>) {
		// if let Some(arg) = &it.argument {
		// 	self.jschanges.insert(JsChange::GenericChange {
		// 		span: Span::new(it.span.start + 6, it.span.start + 6),
		// 		text: format!(" $scramdbg((()=>{{ try {{return arguments}} catch(_){{}} }})(),("),
		// 	});
		// 	self.jschanges.insert(JsChange::GenericChange {
		// 		span: Span::new(expression_span(arg).end, expression_span(arg).end),
		// 		text: format!("))"),
		// 	});
		// }
		walk::walk_return_statement(self, it);
	}

	fn visit_unary_expression(&mut self, it: &UnaryExpression<'a>) {
		if matches!(it.operator, UnaryOperator::Typeof) {
			// don't walk to identifier rewrites since it won't matter
			return;
		}
		walk::walk_unary_expression(self, it);
	}

	// we don't want to rewrite the identifiers here because of a very specific edge case
	fn visit_for_in_statement(&mut self, it: &ForInStatement<'a>) {
		walk::walk_statement(self, &it.body);
	}
	fn visit_for_of_statement(&mut self, it: &ForOfStatement<'a>) {
		walk::walk_statement(self, &it.body);
	}

	fn visit_update_expression(&mut self, _it: &UpdateExpression<'a>) {
		// then no, don't walk it, we don't care
	}

	fn visit_meta_property(&mut self, it: &MetaProperty<'a>) {
		if it.meta.name == "import" {
			self.jschanges.add(JsChange::MetaFn { span: it.span });
		}
	}

	fn visit_assignment_expression(&mut self, it: &AssignmentExpression<'a>) {
		match &it.left {
			AssignmentTarget::AssignmentTargetIdentifier(s) => {
				if ["location"].contains(&s.name.to_string().as_str()) {
					self.jschanges.add(JsChange::Assignment {
						name: s.name.to_compact_str(),
						entirespan: it.span,
						rhsspan: it.right.span(),
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
