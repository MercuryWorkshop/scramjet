use std::error::Error;

use coverage_macro::coverage_checked;
use oxc::{
	allocator::{Allocator, StringBuilder},
	ast::ast::{
		AssignmentExpression, AssignmentTarget, AssignmentTargetMaybeDefault,
		AssignmentTargetProperty, AssignmentTargetPropertyIdentifier, BindingPattern,
		BindingPatternKind, BindingProperty, CallExpression, ChainElement, ComputedMemberExpression,
		WithStatement,
		DebuggerStatement, ExportAllDeclaration, ExportNamedDeclaration, Expression, ForStatement,
		ForStatementInit, ForStatementLeft, FormalParameter, FunctionBody, IdentifierReference,
		ImportDeclaration, ImportExpression, MemberExpression, MetaProperty, NewExpression,
		ObjectAssignmentTarget, ObjectExpression, ObjectPattern, ObjectPropertyKind,
		PrivateIdentifier, PropertyKey, ReturnStatement, SimpleAssignmentTarget, Statement,
		StringLiteral, ThisExpression, UnaryExpression, UnaryOperator, UpdateExpression,
		VariableDeclaration, VariableDeclarationKind, VariableDeclarator,
	},
	ast_visit::{Visit, walk},
	span::{Atom, GetSpan, Span},
};

use crate::{
	cfg::{Config, Flags, IncumbencyMode, UrlRewriter}, changes::{CallReceiver, JsChanges}, rewrite::rewrite,
};

/// Whether evaluating `expr` can short circuit the optional chain it is part of: a `?.` anywhere in it that is
/// not behind parentheses, which end a chain.
fn short_circuits(expr: &Expression) -> bool {
	match expr {
		Expression::StaticMemberExpression(m) => m.optional || short_circuits(&m.object),
		Expression::ComputedMemberExpression(c) => c.optional || short_circuits(&c.object),
		Expression::PrivateFieldExpression(p) => p.optional || short_circuits(&p.object),
		Expression::CallExpression(c) => c.optional || short_circuits(&c.callee),
		_ => false,
	}
}

/// Whether `lazystamp` records the realm for a call to `callee`: one that names `postMessage` as it is written.
/// That is the whole of what makes it lazy - a computed key only counts when it is a literal spelling the name.
fn names_post_message(callee: &Expression) -> bool {
	let is_name = |key: &Expression| match key.get_inner_expression() {
		Expression::StringLiteral(s) => s.value == "postMessage",
		Expression::TemplateLiteral(t) if t.expressions.is_empty() => {
			t.quasis.first().and_then(|q| q.value.cooked.as_ref()).is_some_and(|c| c == "postMessage")
		}
		_ => false,
	};

	match callee.get_inner_expression() {
		Expression::Identifier(s) => s.name == "postMessage",
		Expression::StaticMemberExpression(m) => m.property.name == "postMessage",
		Expression::ComputedMemberExpression(c) => is_name(&c.expression),
		Expression::ChainExpression(chain) => match &chain.expression {
			ChainElement::StaticMemberExpression(m) => m.property.name == "postMessage",
			ChainElement::ComputedMemberExpression(c) => is_name(&c.expression),
			_ => false,
		},
		_ => false,
	}
}

// required stub markers
macro_rules! audit_skip { ($($t:tt)*) => {}; }
#[allow(unused)]
macro_rules! skip_field { ($($t:tt)*) => {}; }

// js MUST not be able to get a reference to any of these because sbx
//
// maybe move this out of this lib?
const UNSAFE_GLOBALS: &[&str] = &["parent", "top", "location", "eval"];

pub struct Visitor<'alloc, 'data, E>
where
	E: UrlRewriter,
{
	pub alloc: &'alloc Allocator,
	pub jschanges: JsChanges<'alloc, 'data>,
	pub error: Option<Box<dyn Error + Sync + Send>>,

	pub config: &'data Config,
	pub rewriter: &'data E,
	pub flags: Flags,

	/// how many `with` bodies the visitor is inside, where a bare `f()` may be called with the `with` object as
	/// its receiver - which is not known until it runs
	pub with_depth: u32,
	/// the members a stamped call has split into a receiver and a lookup, whose links its own rewrite owns
	pub split_members: std::vec::Vec<Span>,
}

impl<'data, E> Visitor<'_, 'data, E>
where
	E: UrlRewriter,
{
	fn rewrite_url(&mut self, url: &StringLiteral<'data>, module: bool) {
		let mut builder = StringBuilder::from_str_in(&self.config.prefix, self.alloc);
		if self.error.is_some() {
			builder.push_str("__URL_REWRITER_ALREADY_ERRORED__");
		} else if let Err(err) =
			self.rewriter
				.rewrite(self.config, &self.flags, &url.value, &mut builder, module)
		{
			self.error.replace(err);
			builder.push_str("__URL_REWRITER_ERROR__");
		}
		let text = builder.into_str();

		self.jschanges
			.add(rewrite!(url.span.shrink(1), Replace { text }));
	}

	fn rewrite_ident(&mut self, name: &Atom, span: Span) {
		if UNSAFE_GLOBALS.contains(&name.as_str()) {
			self.jschanges.add(rewrite!(span, WrapFn { enclose: true }));
		}
	}

	/// Whether `call` is rewritten into a `callfn` call - which takes it out of any chain it is part of.
	fn stamps(&self, call: &CallExpression) -> bool {
		let should_stamp = match &self.flags.incumbency {
			IncumbencyMode::Stamp => true,
			IncumbencyMode::LazyStamp => names_post_message(&call.callee),
			_ => false,
		};
		if !should_stamp {
			return false;
		}

		match call.callee.get_inner_expression() {
			// a direct eval is rewritten as one
			Expression::Identifier(s) if s.name == "eval" && !call.optional => false,
			Expression::Identifier(_) => self.with_depth == 0,
			Expression::Super(_) | Expression::PrivateFieldExpression(_) => false,
			Expression::ChainExpression(c) => !matches!(c.expression, ChainElement::PrivateFieldExpression(_)),
			_ => true,
		}
	}

	/// Whether `object` is a stamped call that can short circuit. Its rewrite ends the chain it was part of, so the
	/// link after it has to short circuit on its own: when the call evaluates to `undefined`, so does the rest of
	/// the chain. That also happens if the call itself returns null or undefined, where the chain would have gone
	/// on and thrown
	fn short_circuited_call(&self, object: &Expression) -> bool {
		matches!(object, Expression::CallExpression(c) if self.stamps(c)) && short_circuits(object)
	}

	fn handle_computed_member_expression(&mut self, it: &ComputedMemberExpression<'data>) {
		if self.flags.disable_computed_wrap { return };
		match &it.expression {
			Expression::NullLiteral(_)
			| Expression::BigIntLiteral(_)
			| Expression::NumericLiteral(_)
			| Expression::RegExpLiteral(_)
			| Expression::BooleanLiteral(_) => {}
			Expression::StringLiteral(lit) => {
				if UNSAFE_GLOBALS.contains(&lit.value.as_str()) {
					self.jschanges
						.add(rewrite!(it.expression.span(), WrapProperty,));
				}
			}
			_ => {
				self.jschanges
					.add(rewrite!(it.expression.span(), WrapProperty,));
			}
		}
	}

	fn recurse_object_assignment_target(
		&mut self,
		s: &ObjectAssignmentTarget<'data>,
		restids: &mut Vec<Atom<'data>>,
		location_assigned: &mut bool,
	) {
		if let Some(r) = &s.rest {
			// { ...rest } = self;
			match &r.target {
				AssignmentTarget::AssignmentTargetIdentifier(i) => {
					if i.name == "location" {
						self.jschanges.add(rewrite!(i.span, TempVar));
						restids.push(self.alloc.alloc_str(&self.config.templocid).into());
						*location_assigned = true;
					} else {
						restids.push(i.name);
					}
				}
				_ => panic!("what?"),
			}
		}
		for prop in &s.properties {
			match prop {
				AssignmentTargetProperty::AssignmentTargetPropertyIdentifier(p) => {
					// { location } = self;
					// correct thing to do here is to change it into an AsignmentTargetPropertyProperty
					// { $sj_location: location } = self;
					if UNSAFE_GLOBALS.contains(&p.binding.name.to_string().as_str()) {
    					let mut tempvar = false;
						if p.binding.name == "location" {
							tempvar = true;
							*location_assigned = true;
						}
						self.jschanges.add(rewrite!(
							p.binding.span(),
							RebindProperty {
								ident: p.binding.name.clone(),
								tempvar,
							}
						));
					}

					if let Some(d) = &p.init {
						// { location = parent } = {};
						// we still need to rewrite whatever stuff might be in the default expression
						walk::walk_expression(self, &d);
					}
				}
				AssignmentTargetProperty::AssignmentTargetPropertyProperty(p) => {
					// { location: x } = self;
					// { location: x = "..."} = self;
					// { location: { href } } = self;
					// { location: { href: x } } = self;
					// { ["location"]: x } = self;

					match &p.name {
						PropertyKey::StaticIdentifier(id) => {
							// { location: x } = self;
							if UNSAFE_GLOBALS.contains(&id.name.to_string().as_str()) {
								self.jschanges.add(rewrite!(
									p.name.span(),
									RewriteProperty { ident: id.name }
								));
							}
						}
						PropertyKey::StringLiteral(s) => {
							if UNSAFE_GLOBALS.contains(&s.value.to_string().as_str()) {
								self.jschanges.add(rewrite!(s.span(), RewriteProperty { ident: s.value }));
							}
						}

						// this is really annoying, we have to list out all the things that *aren't* expressions, you can't just check if it is one
						// otherwise { 0:location } rewrites to { scramjet$prop(0):location } which is obviously invalid syntax
						PropertyKey::NumericLiteral(_) | PropertyKey::RegExpLiteral(_) | PropertyKey::BigIntLiteral(_) | PropertyKey::PrivateIdentifier(_) => {}

						_ => {
							// { ["location"]: x } = self;
							self.jschanges.add(rewrite!(p.name.span(), WrapProperty));
						}
					}

					let mut target;

					if let Some(t) = p.binding.as_assignment_target() {
					    target = t;
					} else {
    					match &p.binding {
    						AssignmentTargetMaybeDefault::AssignmentTargetWithDefault(d) => {
                                target = &d.binding;
                                // { location: x = parent } = {};
    							// we still need to rewrite whatever stuff might be in the default expression
    							walk::walk_expression(self, &d.init);
                            }
                            _=>unreachable!()
                        }
					}

					match &target {
						AssignmentTarget::ObjectAssignmentTarget(p) => {
							self.recurse_object_assignment_target(&p, restids, location_assigned);
						}
						AssignmentTarget::AssignmentTargetIdentifier(p) => {
							if p.name == "location" {
								self.jschanges.add(rewrite!(p.span(), TempVar));
								*location_assigned = true;
							}
						}
						AssignmentTarget::ArrayAssignmentTarget(a) => {
							self.recurse_array_assignment_target(&a, restids, location_assigned);
						}
						_ => {}
					}
				}
			}
		}
	}
	fn recurse_array_assignment_target(
		&mut self,
		s: &oxc::ast::ast::ArrayAssignmentTarget<'data>,
		restids: &mut Vec<Atom<'data>>,
		location_assigned: &mut bool,
	) {
		// note that i don't actually have to care about the rest param here since it wont have dangerous props. i still need to keep track of the object destructure rests though
		for elem in &s.elements {
			if let Some(elem) = elem {
				match elem {
					AssignmentTargetMaybeDefault::AssignmentTargetWithDefault(p) => {
						if let Some(name) = p.binding.get_identifier_name()
							&& name == "location"
						{
							self.jschanges.add(rewrite!(p.span(), TempVar));
							*location_assigned = true;
						}
						walk::walk_expression(self, &p.init);
					}
					AssignmentTargetMaybeDefault::AssignmentTargetIdentifier(p) => {
						if p.name == "location" {
							self.jschanges.add(rewrite!(p.span(), TempVar));
							*location_assigned = true;
						}
					}
					AssignmentTargetMaybeDefault::ObjectAssignmentTarget(o) => {
						self.recurse_object_assignment_target(o, restids, location_assigned);
					}
					AssignmentTargetMaybeDefault::ArrayAssignmentTarget(a) => {
						self.recurse_array_assignment_target(a, restids, location_assigned);
					}
					_ => {}
				}
			}
		}
	}

	fn recurse_binding_pattern(
		&mut self,
		it: &BindingPattern<'data>,
		restids: &mut Vec<Atom<'data>>,
		no_shadow: bool,
		location_assigned: &mut bool,
	) {
		match &it.kind {
			BindingPatternKind::BindingIdentifier(p) => {
				// let a = 0;
				if no_shadow && p.name == "location" {
					self.jschanges.add(rewrite!(p.span, TempVar));
					*location_assigned = true;
				}
			}
			BindingPatternKind::AssignmentPattern(p) => {
				// const {a = 1} = 1;
				walk::walk_binding_pattern(self, &p.left);
				walk::walk_expression(self, &p.right);
			}
			BindingPatternKind::ObjectPattern(p) => {
				for prop in &p.properties {
					match &prop.key {
						PropertyKey::StaticIdentifier(id) => {
							if UNSAFE_GLOBALS.contains(&id.name.to_string().as_str()) {
								if prop.shorthand {
									// const { location } = self;
									let mut tempvar = false;
									if no_shadow && id.name == "location" {
										tempvar = true;
										*location_assigned = true;
									}
									self.jschanges.add(rewrite!(
										id.span(),
										RebindProperty {
											ident: id.name,
											tempvar
										}
									));

									// don't recurse into the value because the value is the same and it would double rewrite the prop
									continue;
								} else {
									// const { location: a } = self;
									if no_shadow && id.name == "location" {
										self.jschanges.add(rewrite!(
											id.span(),
											RewriteProperty {
												ident: self
													.alloc
													.alloc_str(&self.config.templocid)
													.into()
											}
										));
										*location_assigned = true;
									} else {
										self.jschanges.add(rewrite!(
											id.span(),
											RewriteProperty { ident: id.name }
										));
									}
								}
							}
						}
						PropertyKey::StringLiteral(id) => {
							// const { "location": x } = self;
							// this cannot be shorthand, so we can use the easy path
							if UNSAFE_GLOBALS.contains(&id.value.to_string().as_str()) {
								self.jschanges.add(rewrite!(
									id.span.shrink(1),
									RewriteProperty { ident: id.value }
								));
							}
						}

						// see comment in recurse_object_assignment_target
						PropertyKey::NumericLiteral(_) | PropertyKey::RegExpLiteral(_) | PropertyKey::BigIntLiteral(_) | PropertyKey::PrivateIdentifier(_) => {}

						_ => {
							// const { ["location"]: x } = self;
							self.jschanges.add(rewrite!(prop.key.span(), WrapProperty));
						}
					}
					self.recurse_binding_pattern(&prop.value, restids, no_shadow, location_assigned);
				}

				if let Some(r) = &p.rest {
					match &r.argument.kind {
						BindingPatternKind::BindingIdentifier(i) => {
							if no_shadow && i.name == "location" {
								self.jschanges.add(rewrite!(i.span, TempVar));
								restids.push(self.alloc.alloc_str(&self.config.templocid).into());
								*location_assigned = true;
							} else {
								restids.push(i.name);
							}
						}
						_ => panic!("what?"),
					}
				}
			}
			_ => {}
		}
	}

	fn handle_var_declarator(
		&mut self,
		v: &VariableDeclaration<'data>,
		restids: &mut Vec<Atom<'data>>,
		location_assigned: &mut bool,
	) {
		// (const/let) location = ... is perfectly fine, no matter the scope
		// var location = ... is dangerous, it will assign to the real global if called in scope
		let no_shadow = matches!(v.kind, VariableDeclarationKind::Var);
		for dec in &v.declarations {
			if let Some(ini) = &dec.init {
				walk::walk_expression(self, ini);
			}
			self.recurse_binding_pattern(&dec.id, restids, no_shadow, location_assigned);
		}
	}

	fn handle_assignment_target_member(&mut self, target: &AssignmentTarget<'data>) {
		match target {
			AssignmentTarget::StaticMemberExpression(s) => {
				// window.location = ...
				if UNSAFE_GLOBALS.contains(&s.property.name.as_str()) {
					self.jschanges.add(rewrite!(
						s.property.span(),
						RewriteProperty {
							ident: s.property.name
						}
					));
				}

				// walk the left hand side of the member expression (`window` for the `window.location = ...` case)
				walk::walk_expression(self, &s.object);
			}
			AssignmentTarget::ComputedMemberExpression(s) => {
				// window["location"] = ...
				self.handle_computed_member_expression(s);
				// `window`
				walk::walk_expression(self, &s.object);
				// `"location"`
				walk::walk_expression(self, &s.expression);
			}
			_ => {}
		}
	}

	fn handle_for_of_in(&mut self, left: &ForStatementLeft<'data>, right: &Expression<'data>, body: &Statement<'data>) {
    	let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;
		let declare_local_location: bool;
		if let ForStatementLeft::VariableDeclaration(v) = &left {
			self.handle_var_declarator(&v, &mut restids, &mut location_assigned);
			// var { location } = ... is special because it will rewrite both the member access to $sj_location
			// and the actual name of the variable to $scramjet$temploc so we can set it back later
			// but this means that the variable location never actually gets assigned
			// so if it was actually meant to be a local, it won't exist in scope
			// we flag this here so it will be appended tos the variable declarations in cleanup
			declare_local_location = location_assigned;
		} else {
		    let target = left.as_assignment_target().unwrap();
		    match target {
				AssignmentTarget::AssignmentTargetIdentifier(s) => {
					if &s.name == "location" {
						self.jschanges.add(rewrite!(s.span, TempVar));
						location_assigned = true;
					}
				}

				AssignmentTarget::StaticMemberExpression(_) | AssignmentTarget::ComputedMemberExpression(_) => {
					self.handle_assignment_target_member(target);
				}
				AssignmentTarget::ObjectAssignmentTarget(o) => {
					self.recurse_object_assignment_target(o, &mut restids, &mut location_assigned);
				}
				AssignmentTarget::ArrayAssignmentTarget(a) => {
					self.recurse_array_assignment_target(a, &mut restids, &mut location_assigned);
				}
				AssignmentTarget::PrivateFieldExpression(_) => {
					// `for (location.#p of ...)`
					audit_skip!("private field can never contain anything unsafe");
				}
				_ => {}
			}
			declare_local_location = false;
		}

		if location_assigned || restids.len() > 0 {
			match &body {
				Statement::BlockStatement(b) => {
					self.jschanges.add(rewrite!(
						Span::new(b.span.start + 1, b.span.end - 1),
						CleanFunction {
							restids,
							location_assigned,
							expression: false,
							wrap: false,
							declare_local_location,
						}
					));
				}
				Statement::BreakStatement(_)
				| Statement::ContinueStatement(_)
				| Statement::EmptyStatement(_)
				| Statement::DebuggerStatement(_) => {}
				_ => {
					self.jschanges.add(rewrite!(
						body.span(),
						CleanFunction {
							restids,
							location_assigned,
							expression: false,
							wrap: true,
							declare_local_location,
						}
					));
				}
			}
		}
		walk::walk_expression(self, &right);
		walk::walk_statement(self, &body);
	}
}

impl<'data, E> Visit<'data> for Visitor<'_, 'data, E>
where
	E: UrlRewriter,
{
	#[coverage_checked(IdentifierReference)]
	fn visit_identifier_reference(&mut self, it: &IdentifierReference) {
		if UNSAFE_GLOBALS.contains(&it.name.as_str()) {
			self.jschanges
				.add(rewrite!(it.span, WrapFn { enclose: false }));
		}
	}

	#[coverage_checked(NewExpression)]
	fn visit_new_expression(&mut self, it: &NewExpression<'data>) {
		match &it.callee {
			Expression::StaticMemberExpression(_) | Expression::Identifier(_) => {
				// new top(), new location.top(), etc
				// rewriting to new $wrap(location).top() WILL change semantics
				// so it has to be wrapped to new ($wrap(location).top)()
				// TODO: skip paren wrap if it's determined to be safe
				self.jschanges.add(rewrite!(it.callee.span(), WrapNew));
				walk::walk_expression(self, &it.callee);
			}
			Expression::ComputedMemberExpression(c) => {
				walk::walk_expression(self, &c.expression);
			}
			_=>{
				// any other kind of expression
				// new (f(location))()
				walk::walk_expression(self, &it.callee);
			}
		}
		walk::walk_arguments(self, &it.arguments);
	}

	#[coverage_checked(MemberExpression)]
	fn visit_member_expression(&mut self, it: &MemberExpression<'data>) {
		if !it.optional() && !self.split_members.contains(&it.span()) && self.short_circuited_call(it.object()) {
			let object_end = it.object().span().end;
			let (end, opener) = match &it {
				MemberExpression::StaticMemberExpression(s) => (s.property.span.start, "?."),
				MemberExpression::ComputedMemberExpression(c) => (c.expression.span().start, "?.["),
				MemberExpression::PrivateFieldExpression(p) => (p.field.span.start, "?."),
			};
			self.jschanges.add(rewrite!(Span::new(object_end, end), OptionalLink { opener }));
		}

		match &it {
			MemberExpression::StaticMemberExpression(s) => {
				if UNSAFE_GLOBALS.contains(&s.property.name.as_str()) {
					self.jschanges.add(rewrite!(
						s.property.span(),
						RewriteProperty {
							ident: s.property.name
						}
					));
				}
			}
			MemberExpression::ComputedMemberExpression(s) => {
				self.handle_computed_member_expression(s);
			}
			_ => {}
		}

		walk::walk_member_expression(self, it);
	}

	#[coverage_checked(WithStatement)]
	fn visit_with_statement(&mut self, it: &WithStatement<'data>) {
		self.visit_expression(&it.object);
		self.with_depth += 1;
		self.visit_statement(&it.body);
		self.with_depth -= 1;
	}

	#[coverage_checked(DebuggerStatement)]
	fn visit_debugger_statement(&mut self, it: &DebuggerStatement) {
		// delete debugger statements entirely. some sites will spam debugger as an anti-debugging measure, and we don't want that!
		self.jschanges.add(rewrite!(it.span, Delete));
	}

	// we can't overwrite window.eval in the normal way because that would make everything an
	// indirect eval, which could break things. we handle that edge case here
	#[coverage_checked(CallExpression)]
	fn visit_call_expression(&mut self, it: &CallExpression<'data>) {
		audit_skip!(it.callee, "top(0): none of the unsafe globals can be called as functions, other than eval which we handle above");
		if let Expression::Identifier(s) = &it.callee {
			// if it's optional that actually makes it an indirect eval which is handled separately
			if s.name == "eval" && !it.optional {
				self.jschanges.add(rewrite!(
					it.span,
					Eval {
						inner: Span::new(s.span.end + 1, it.span.end - 1),
					}
				));

				// then we walk the arguments, but not the callee, since we want it to resolve to
				// the real eval
				walk::walk_arguments(self, &it.arguments);
				return;
			}
		}

		let should_stamp = match &self.flags.incumbency {
			IncumbencyMode::Stamp => true,
			IncumbencyMode::LazyStamp => names_post_message(&it.callee),
			_ => false,
		};

		if should_stamp {
			let args = it.arguments_span();
			let callee = it.callee.get_inner_expression();
			// `(a?.b)()` is still a call of `a.b` with `a` as its receiver. It is not part of the chain, though: when
			// the chain short circuits, the call is of `undefined`
			let (member, throws) = match callee {
				Expression::ComputedMemberExpression(c) => {
					(Some((&c.object, c.expression.span(), c.optional, true)), false)
				}
				Expression::StaticMemberExpression(m) => {
					(Some((&m.object, m.property.span(), m.optional, false)), false)
				}
				Expression::ChainExpression(chain) => match &chain.expression {
					ChainElement::ComputedMemberExpression(c) => {
						(Some((&c.object, c.expression.span(), c.optional, true)), !it.optional)
					}
					ChainElement::StaticMemberExpression(m) => {
						(Some((&m.object, m.property.span(), m.optional, false)), !it.optional)
					}
					_ => (None, false),
				},
				_ => (None, false),
			};
			let private = matches!(callee, Expression::PrivateFieldExpression(_))
				|| matches!(callee, Expression::ChainExpression(c) if matches!(c.expression, ChainElement::PrivateFieldExpression(_)));

			match member {
				// `super.m()` looks the method up on the home object but calls it with the `this` already in scope,
				// and `super` is a keyword that cannot be parked in a temp. `super.m` does read as a value though,
				// so hand the lookup over whole and name the receiver directly
				Some((object, ..))
					if matches!(object.get_inner_expression(), Expression::Super(_)) =>
				{
					self.jschanges.add(rewrite!(it.span, LiteralCallFn {
						args,
						inner: it.callee.span(),
						receiver: CallReceiver::This,
						optional_call: it.optional,
					}))
				}
				Some((object, expression, optional, computed)) => {
					// splitting the callee into a receiver and a lookup loses the short circuit a `?.` further up
					// the chain would have done, so every one of them gets a nullish check of its own
					let mut guards = 0;
					let mut link = object.get_inner_expression();
					loop {
						let (inner, property, optional, computed) = match link {
							Expression::ComputedMemberExpression(c) => {
								(&c.object, c.expression.span(), c.optional, true)
							}
							Expression::StaticMemberExpression(m) => {
								(&m.object, m.property.span(), m.optional, false)
							}
							_ => break,
						};
						self.split_members.push(link.span());
						if optional || self.short_circuited_call(inner) {
							let gap = Span::new(inner.span().end, property.start);
							self.jschanges.add(rewrite!(gap, ChainGuard { computed, throws }));
							guards += 1;
						}
						link = inner.get_inner_expression();
					}

					self.split_members.push(callee.span());
					self.jschanges.add(rewrite!(it.span, MemberCallFn {
						args,
						object: object.span(),
						expression,
						optional: optional || self.short_circuited_call(object),
						computed,
						optional_call: it.optional,
						guards,
						throws,
					}))
				}
				// even if you set `this.#p()` to a native method, it will always throw illegal invocation or a typeerror
				// if you ever use this for something other than incumbency stamping this must be handled properly
				None if private => {}
				// `super()` runs the parent constructor rather than calling a function value, and `super` does not
				// read as one - there is nothing here to hand to `callfn`
				None if matches!(callee, Expression::Super(_)) => {}
				// inside `with`, a bare `f()` is called with the `with` object as its receiver if that is where `f`
				// was found, which only the running code knows
				None if self.with_depth > 0 && matches!(callee, Expression::Identifier(_)) => {}
				// anything else is called with no receiver of its own
				None => self.jschanges.add(rewrite!(it.span, LiteralCallFn {
					args,
					inner: it.callee.span(),
					receiver: CallReceiver::Undefined,
					optional_call: it.optional || self.short_circuited_call(&it.callee),
				})),
			}
		} else if !it.optional && self.short_circuited_call(&it.callee) {
			// the call's opening paren, up to its first argument or its closing paren
			let end = it.arguments.first().map_or(it.span.end - 1, |a| a.span().start);
			self.jschanges.add(rewrite!(
				Span::new(it.callee.span().end, end),
				OptionalLink { opener: "?.(" }
			));
		}

		walk::walk_call_expression(self, it);
	}

	#[coverage_checked(ImportDeclaration)]
	fn visit_import_declaration(&mut self, it: &ImportDeclaration<'data>) {
		let str = it.source.to_string();
		if str.contains(":")
			|| str.starts_with("/")
			|| str.starts_with(".")
			|| str.starts_with("..")
		{
			self.rewrite_url(&it.source, true);
		}
		walk::walk_import_declaration(self, it);
	}
	#[coverage_checked(ImportExpression)]
	fn visit_import_expression(&mut self, it: &ImportExpression<'data>) {
		self.jschanges.add(rewrite!(
			Span::new(it.span.start, it.span.start + 7),
			ImportFn
		));
		walk::walk_import_expression(self, it);
	}

	#[coverage_checked(ExportAllDeclaration)]
	fn visit_export_all_declaration(&mut self, it: &ExportAllDeclaration<'data>) {
		self.rewrite_url(&it.source, true);
	}
	#[coverage_checked(ExportNamedDeclaration)]
	fn visit_export_named_declaration(&mut self, it: &ExportNamedDeclaration<'data>) {
		if let Some(source) = &it.source {
			self.rewrite_url(source, true);
		}
		// the declaration body is normal code and must be rewritten, we just can't touch the
		// specifiers below since those are binding names, not references
		if let Some(declaration) = &it.declaration {
			self.visit_declaration(declaration);
		}
		audit_skip!(it.specifiers, "export {x as y} is safe because you can only export locals");
	}

	#[coverage_checked(TryStatement)]
	fn visit_try_statement(&mut self, it: &oxc::ast::ast::TryStatement<'data>) {
		// for debugging we need to know what the error was

		if self.flags.capture_errors
			&& let Some(h) = &it.handler
			&& let Some(name) = &h.param
			&& let Some(ident) = name.pattern.get_identifier_name()
		{
			let start = h.body.span.start + 1;
			self.jschanges
				.add(rewrite!(Span::new(start, start), ScramErr { ident }));
		}

		if !self.flags.destructure_rewrites {
			walk::walk_try_statement(self, it);
			return;
		}

		if let Some(h) = &it.handler {
			if let Some(p) = &h.param {
				let mut restids: Vec<Atom<'data>> = Vec::new();
				let mut location_assigned: bool = false;

				// variables defined in catch shadow the global, don't rewrite location to the temploc here
				self.recurse_binding_pattern(
					&p.pattern,
					&mut restids,
					false,
					&mut location_assigned,
				);
				if h.body.body.len() > 0 {
					self.jschanges.add(rewrite!(
						h.body.body[0].span(),
						CleanFunction {
							restids,
							expression: false,
							location_assigned,
							wrap: false,
							declare_local_location: false,
						}
					));
				}
			}
			walk::walk_block_statement(self, &h.body);
		}

		if let Some(f) = &it.finalizer {
    		walk::walk_block_statement(self, f);
		}
		walk::walk_block_statement(self, &it.block);
	}

	#[coverage_checked(ObjectExpression)]
	fn visit_object_expression(&mut self, it: &ObjectExpression<'data>) {
		for prop in &it.properties {
			if let ObjectPropertyKind::ObjectProperty(p) = prop
				&& let Expression::Identifier(s) = &p.value
				&& UNSAFE_GLOBALS.contains(&s.name.to_string().as_str())
				&& p.shorthand
			{
				self.jschanges
					.add(rewrite!(s.span, ShorthandObj { name: s.name }));
				return;
			}
		}

		walk::walk_object_expression(self, it);
	}

	#[coverage_checked(Function)]
	fn visit_function(
		&mut self,
		it: &oxc::ast::ast::Function<'data>,
		flags: oxc::syntax::scope::ScopeFlags,
	) {
		if !self.flags.destructure_rewrites {
			walk::walk_function(self, it, flags);
			return;
		}

		let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;
		for param in &it.params.items {
			// function params shadow global, don't rewrite temploc
			self.recurse_binding_pattern(
				&param.pattern,
				&mut restids,
				false,
				&mut location_assigned,
			);
		}

		if let Some(b) = &it.body {
		    // calling the actual visit method is neccesary here, walking isn't enough for some reason
			self.visit_function_body(b);
	    	if restids.len() > 0 || location_assigned {
				if let Some(stmt) = b.statements.get(0) {
					let span = stmt.span();
					self.jschanges.add(rewrite!(
						Span::new(span.start, span.start),
						CleanFunction {
							restids,
							expression: false,
							location_assigned,
							wrap: false,
							declare_local_location: false,
						}
					));
				}
			}
		}
	}

	#[coverage_checked(ArrowFunctionExpression)]
	fn visit_arrow_function_expression(
		&mut self,
		it: &oxc::ast::ast::ArrowFunctionExpression<'data>,
	) {
		if !self.flags.destructure_rewrites {
			walk::walk_arrow_function_expression(self, it);
			return;
		}

		let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;
		for param in &it.params.items {
			self.recurse_binding_pattern(
				&param.pattern,
				&mut restids,
				false,
				&mut location_assigned,
			);
		}

		self.visit_function_body(&it.body);
		if let Some(stmt) = &it.body.statements.get(0) {
			self.jschanges.add(rewrite!(
				stmt.span(),
				CleanFunction {
					restids,
					expression: it.expression,
					location_assigned,
					wrap: false,
					declare_local_location: false,
				}
			));
		}
	}

	#[coverage_checked(ForStatement)]
	fn visit_for_statement(&mut self, it: &ForStatement<'data>) {
		if !self.flags.destructure_rewrites {
			walk::walk_for_statement(self, it);
			return;
		}

		let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;
		if let Some(i) = &it.init {
			if let ForStatementInit::VariableDeclaration(d) = &i {
				self.handle_var_declarator(d, &mut restids, &mut location_assigned);

				if location_assigned || restids.len() > 0 {
					let declare_local_location = location_assigned;
					self.jschanges.add(rewrite!(
						d.span,
						CleanVariableDeclaration {
							restids,
							location_assigned,
							declare_local_location,
						}
					));
				}
			} else {
				// we've narrowed the for specific stuff so it's just a regular expression now
				walk::walk_for_statement_init(self, i);
			}
		}

		if let Some(t) = &it.test {
			walk::walk_expression(self, t);
		}

		if let Some(t) = &it.update {
			walk::walk_expression(self, t);
		}

		walk::walk_statement(self, &it.body);
	}

	#[coverage_checked(ForOfStatement)]
	fn visit_for_of_statement(&mut self, it: &oxc::ast::ast::ForOfStatement<'data>) {
    	self.handle_for_of_in(&it.left, &it.right, &it.body);
	}
	#[coverage_checked(ForInStatement)]
	fn visit_for_in_statement(&mut self, it: &oxc::ast::ast::ForInStatement<'data>) {
    	self.handle_for_of_in(&it.left, &it.right, &it.body);
	}

	#[coverage_checked(FunctionBody)]
	fn visit_function_body(&mut self, it: &FunctionBody<'data>) {
		// tag function for use in sourcemaps

		if self.flags.do_sourcemaps {
			self.jschanges
				.add(rewrite!(Span::new(it.span.start, it.span.start), SourceTag));
		}

		walk::walk_function_body(self, it);
	}

	#[coverage_checked(UnaryExpression)]
	fn visit_unary_expression(&mut self, it: &UnaryExpression<'data>) {
		if matches!(it.operator, UnaryOperator::Typeof) {
			match it.argument {
				Expression::Identifier(_) => {
					// `typeof location` -> `typeof $wrap(location)` seems like a sane rewrite but it's incorrect
					// typeof has the special property of not caring whether the identifier is undefined
					// and this won't escape anyway, so don't rewrite
					audit_skip!(it.argument, "safe, identifier tree cannot expand into an escape");
					return;
				}
				_ => {
					// `typeof (location)` / `typeof location.href` / `typeof function()`
					// this is safe to rewrite
				}
			}
		}
		walk::walk_unary_expression(self, it);
	}

	#[coverage_checked(UpdateExpression)]
	fn visit_update_expression(&mut self, it: &UpdateExpression<'data>) {
		// this is like a ++ or -- operator
		match it.argument {
			SimpleAssignmentTarget::AssignmentTargetIdentifier(_) => {
				// if it's an identifier we cannot rewrite it
				// $wrap(location)++ is invalid syntax

				// so it's safer to assume that this "location" is a local
				// even if it's real location you can't escape with it anyway
				// unless you consider navigating to "https://proxy.com/NaN" escaping
				audit_skip!(it.argument, "ident++ would need $wrap(ident)++ which is invalid syntax; arithmetic on location coerces to NaN and assigns the string back, which navigates only to a non-attacker-controlled URL");
				return;
			}
			_ => {}
		}

		// if it's not a simple identifier it's probably a member expression which is safe
		walk::walk_update_expression(self, it);
	}

	#[coverage_checked(MetaProperty)]
	fn visit_meta_property(&mut self, it: &MetaProperty<'data>) {
		if it.meta.name == "import" {
			self.jschanges.add(rewrite!(it.span, MetaFn));
		}
	}

	#[coverage_checked(VariableDeclaration)]
	fn visit_variable_declaration(&mut self, it: &oxc::ast::ast::VariableDeclaration<'data>) {
		if !self.flags.destructure_rewrites {
			walk::walk_variable_declaration(self, it);
			return;
		}

		let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;
		self.handle_var_declarator(&it, &mut restids, &mut location_assigned);

		if location_assigned || restids.len() > 0 {
			let declare_local_location = location_assigned;
			self.jschanges.add(rewrite!(
				Span::new(it.span.end, it.span.end),
				CleanFunction {
					restids,
					expression: false,
					location_assigned,
					wrap: false,
					declare_local_location,
				}
			));
		}
	}

	#[coverage_checked(AssignmentExpression)]
	fn visit_assignment_expression(&mut self, it: &AssignmentExpression<'data>) {
		match &it.left {
			AssignmentTarget::AssignmentTargetIdentifier(s) => {
				// location = ...
				// location is the only unsafe global that has a setter
				if &s.name == "location" {
					self.jschanges.add(rewrite!(
						it.span,
						Assignment {
							name: s.name,
							rhs: it.right.span(),
							op: it.operator,
						}
					));
				}
			}
			AssignmentTarget::StaticMemberExpression(_) | AssignmentTarget::ComputedMemberExpression(_) => {
				self.handle_assignment_target_member(&it.left);
			}
			AssignmentTarget::ObjectAssignmentTarget(o) => {
				if self.flags.destructure_rewrites {
					let mut restids: Vec<Atom<'data>> = Vec::new();
					let mut location_assigned: bool = false;
					self.recurse_object_assignment_target(o, &mut restids, &mut location_assigned);

					if restids.len() > 0 || location_assigned {
						self.jschanges.add(rewrite!(
							it.span,
							WrapObjectAssignment {
								restids,
								location_assigned
							}
						));
					}
				}
			}
			AssignmentTarget::ArrayAssignmentTarget(a) => {
				if self.flags.destructure_rewrites {
					let mut restids: Vec<Atom<'data>> = Vec::new();
					let mut location_assigned: bool = false;
					self.recurse_array_assignment_target(a, &mut restids, &mut location_assigned);
					if restids.len() > 0 || location_assigned {
						self.jschanges.add(rewrite!(
							it.span,
							WrapObjectAssignment {
								restids,
								location_assigned
							}
						));
					}
				}
			}
			AssignmentTarget::PrivateFieldExpression(_) => {
				// `location.#p = x` — the private-field brand check throws
				// TypeError before the identifier value is exposed to the
				// program, so the bare `location` here cannot escape.
				audit_skip!("PrivateField LHS: brand check throws TypeError before exposure");
			}
			_ => {}
		}
		walk::walk_expression(self, &it.right);
	}
}
