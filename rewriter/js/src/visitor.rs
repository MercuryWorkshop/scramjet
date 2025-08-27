use std::error::Error;

use oxc::{
	allocator::{Allocator, StringBuilder},
	ast::ast::{
		AssignmentExpression, AssignmentTarget, AssignmentTargetMaybeDefault, AssignmentTargetProperty, AssignmentTargetPropertyIdentifier, BindingPattern, BindingPatternKind, BindingProperty, CallExpression, ComputedMemberExpression, DebuggerStatement, ExportAllDeclaration, ExportNamedDeclaration, Expression, ForStatement, FormalParameter, FunctionBody, IdentifierReference, ImportDeclaration, ImportExpression, MemberExpression, MetaProperty, NewExpression, ObjectAssignmentTarget, ObjectExpression, ObjectPattern, ObjectPropertyKind, PrivateIdentifier, PropertyKey, ReturnStatement, SimpleAssignmentTarget, StringLiteral, ThisExpression, UnaryExpression, UnaryOperator, UpdateExpression, VariableDeclaration, VariableDeclarationKind
	},
	ast_visit::{walk, Visit},
	span::{Atom, GetSpan, Span},
};
use oxc::ast::ast::ForStatementInit;

use crate::{
	cfg::{Config, Flags, UrlRewriter},
	changes::JsChanges,
	rewrite::rewrite,
};

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

	// fn walk_member_expression(&mut self, it: &Expression) -> bool {
	// 	match it {
	// 		Expression::Identifier(s) => false,
	// 		Expression::StaticMemberExpression(s) => {
	// 			if UNSAFE_GLOBALS.contains(&s.property.name.as_str()) {
	// 				// self.jschanges.add(rewrite!(s.span, WrapAccess {
	// 				//          ident: s.property.name,
	// 				//          propspan: s.property.span,
	// 				//      }
	// 				// ));
	// 			}
	// 			self.walk_member_expression(&s.object)
	// 		}
	// 		Expression::ComputedMemberExpression(s) => self.walk_member_expression(&s.object),
	// 		_ => false,
	// 	}
	// }
	fn walk_computed_member_expression(&mut self, it: &ComputedMemberExpression<'data>) {
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
						self.jschanges.add(rewrite!(
							p.binding.span(),
							RebindProperty {
								ident: p.binding.name.clone()
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
						PropertyKey::PrivateIdentifier(_) => {
							// doesn't matter
						}
						// (expression variant)
						_ => {
							// { ["location"]: x } = self;

							// TODO: check literals
							self.jschanges.add(rewrite!(p.name.span(), WrapProperty));
						}
					}

					match &p.binding {
						AssignmentTargetMaybeDefault::AssignmentTargetWithDefault(d) => {
							// { location: x = parent } = {};
							// if let Some(name) = p.binding.iden && name == "location" {
							//     self.jschanges.add(rewrite!(p.span(), TempVar));
							//                          *location_assigned = true;
							// 			}
							// we still need to rewrite whatever stuff might be in the default expression
							walk::walk_expression(self, &d.init);
						}
						AssignmentTargetMaybeDefault::ObjectAssignmentTarget(p) => {
							self.recurse_object_assignment_target(p, restids, location_assigned);
						}
						AssignmentTargetMaybeDefault::AssignmentTargetIdentifier(p) => {
							if p.name == "location" {
								self.jschanges.add(rewrite!(p.span(), TempVar));
								*location_assigned = true;
							}
						}
						AssignmentTargetMaybeDefault::ArrayAssignmentTarget(a) => {
							self.recurse_array_assignment_target(a, restids, location_assigned);
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
									self.jschanges.add(rewrite!(
										id.span(),
										RebindProperty { ident: id.name }
									));
								} else {
									// const { location: a } = self;
									self.jschanges.add(rewrite!(
										id.span(),
										RewriteProperty { ident: id.name }
									));
								}
							}
						}
						PropertyKey::PrivateIdentifier(_) => {
							// doesn't matter
						}
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
								restids
									.push(self.alloc.alloc_str(&self.config.templocid).into());
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

	fn scramitize(&mut self, span: Span) {
		self.jschanges.add(rewrite!(span, Scramitize));
	}
}

impl<'data, E> Visit<'data> for Visitor<'_, 'data, E>
where
	E: UrlRewriter,
{
	fn visit_identifier_reference(&mut self, it: &IdentifierReference) {
		if UNSAFE_GLOBALS.contains(&it.name.as_str()) {
			self.jschanges
				.add(rewrite!(it.span, WrapFn { enclose: false }));
		}
	}

	fn visit_new_expression(&mut self, it: &NewExpression<'data>) {
		// ??
		// self.walk_member_expression(&it.callee);
		walk::walk_arguments(self, &it.arguments);
	}

	fn visit_member_expression(&mut self, it: &MemberExpression<'data>) {
		match &it {
			MemberExpression::StaticMemberExpression(s) => {
				// TODO
				// you could break this with ["postMessage"] etc
				// however this code only exists because of recaptcha whatever
				// and it would slow down js execution a lot
				if s.property.name == "postMessage" {
					self.jschanges.add(rewrite!(s.property.span, SetRealmFn));

					walk::walk_expression(self, &s.object);
					return; // unwise to walk the rest of the tree
				}

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
				self.walk_computed_member_expression(s);
			}
			_ => {}
		}

		walk::walk_member_expression(self, it);
	}

	fn visit_debugger_statement(&mut self, it: &DebuggerStatement) {
		// delete debugger statements entirely. some sites will spam debugger as an anti-debugging measure, and we don't want that!
		self.jschanges.add(rewrite!(it.span, Delete));
	}

	// we can't overwrite window.eval in the normal way because that would make everything an
	// indirect eval, which could break things. we handle that edge case here
	fn visit_call_expression(&mut self, it: &CallExpression<'data>) {
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
		if self.flags.scramitize {
			self.scramitize(it.span);
		}
		walk::walk_call_expression(self, it);
	}

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
	fn visit_import_expression(&mut self, it: &ImportExpression<'data>) {
		self.jschanges.add(rewrite!(
			Span::new(it.span.start, it.span.start + 7),
			ImportFn
		));
		walk::walk_import_expression(self, it);
	}

	fn visit_export_all_declaration(&mut self, it: &ExportAllDeclaration<'data>) {
		self.rewrite_url(&it.source, true);
	}
	fn visit_export_named_declaration(&mut self, it: &ExportNamedDeclaration<'data>) {
		if let Some(source) = &it.source {
			self.rewrite_url(source, true);
		}
		// do not walk further, we don't want to rewrite the identifiers
	}

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
				self.recurse_binding_pattern(&p.pattern, &mut restids, false, &mut location_assigned);
				self.jschanges.add(rewrite!(
					h.body.body[0].span(),
					CleanFunction {
						restids,
						expression: false,
						location_assigned,
					}
				));
			}
		}
	}

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
			self.recurse_binding_pattern(&param.pattern, &mut restids, false, &mut location_assigned);
		}


		if restids.len() > 0 || location_assigned {
    		if let Some(b) = &it.body {
    			walk::walk_function_body(self, b);
    			if let Some(stmt) = b.statements.get(0) {
    				let span = stmt.span();
    				self.jschanges.add(rewrite!(
    					Span::new(span.start, span.start),
    					CleanFunction {
    						restids,
    						expression: false,
    						location_assigned,
    					}
    				));
    			}
    		}
		}
	}

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
			self.recurse_binding_pattern(&param.pattern, &mut restids, false, &mut location_assigned);
		}

		walk::walk_function_body(self, &it.body);
		if let Some(stmt) = &it.body.statements.get(0) {
			self.jschanges.add(rewrite!(
				stmt.span(),
				CleanFunction {
					restids,
					expression: it.expression,
					location_assigned,
				}
			));
		}
	}

	fn visit_for_statement(&mut self, it: &ForStatement<'data>) {
	    if !self.flags.destructure_rewrites {
    		walk::walk_for_statement(self, it);
    		return;
    	}

        let mut restids: Vec<Atom<'data>> = Vec::new();
        let mut location_assigned: bool = false;
        if let Some(i) = &it.init {
            if let ForStatementInit::VariableDeclaration(d) = &i {
                let no_shadow = matches!(d.kind, VariableDeclarationKind::Var);
                for dec in &d.declarations {
                    if let Some(ini) = &dec.init {
                        walk::walk_expression(self, ini);
                    }

                    self.recurse_binding_pattern(&dec.id, &mut restids, no_shadow, &mut location_assigned);
                }

                if location_assigned || restids.len() > 0 {
                    self.jschanges.add(rewrite!(
                        d.span,
                        CleanVariableDeclaration {
                            restids,
                            location_assigned,
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

    }

	fn visit_function_body(&mut self, it: &FunctionBody<'data>) {
		// tag function for use in sourcemaps
		if self.flags.do_sourcemaps {
			self.jschanges
				.add(rewrite!(Span::new(it.span.start, it.span.start), SourceTag));
		}

		walk::walk_function_body(self, it);
	}

	fn visit_unary_expression(&mut self, it: &UnaryExpression<'data>) {
		if matches!(it.operator, UnaryOperator::Typeof) {
			match it.argument {
				Expression::Identifier(_) => {
					// `typeof location` -> `typeof $wrap(location)` seems like a sane rewrite but it's incorrect
					// typeof has the special property of not caring whether the identifier is undefined
					// and this won't escape anyway, so don't rewrite
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

	fn visit_update_expression(&mut self, it: &UpdateExpression<'data>) {
		// this is like a ++ or -- operator
		match it.argument {
			SimpleAssignmentTarget::AssignmentTargetIdentifier(_) => {
				// if it's an identifier we cannot rewrite it
				// $wrap(location)++ is invalid syntax

				// so it's safer to assume that this "location" is a local
				// even if it's real location you can't escape with it anyway
				// unless you consider navigating to "https://proxy.com/NaN" escaping
				return;
			}
			_ => {}
		}

		// if it's not a simple identifier it's probably a member expression which is safe
		walk::walk_update_expression(self, it);
	}

	fn visit_meta_property(&mut self, it: &MetaProperty<'data>) {
		if it.meta.name == "import" {
			self.jschanges.add(rewrite!(it.span, MetaFn));
		}
	}

	fn visit_variable_declaration(&mut self, it: &oxc::ast::ast::VariableDeclaration<'data>) {
		if !self.flags.destructure_rewrites {
			walk::walk_variable_declaration(self, it);
			return;
		}

		// (const/let) location = ... is perfectly fine, no matter the scope
		// var location = ... is dangerous, it will assign to the real global if called in scope
		let no_shadow = matches!(it.kind, VariableDeclarationKind::Var);

		let mut restids: Vec<Atom<'data>> = Vec::new();
		let mut location_assigned: bool = false;

		for declaration in &it.declarations {
			if let Some(e) = &declaration.init {
				walk::walk_expression(self, e);
			}
			self.recurse_binding_pattern(&declaration.id, &mut restids, no_shadow, &mut location_assigned);
		}

		self.jschanges.add(rewrite!(
			Span::new(it.span.end, it.span.end),
			CleanFunction {
				restids,
				expression: false,
				location_assigned,
			}
		));
	}

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
				self.walk_computed_member_expression(s);
				// `window`
				walk::walk_expression(self, &s.object);
				// `"location"`
				walk::walk_expression(self, &s.expression);
			}
			AssignmentTarget::ObjectAssignmentTarget(o) => {
				if !self.flags.destructure_rewrites {
					return;
				}

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
				return;
			}
			AssignmentTarget::ArrayAssignmentTarget(a) => {
				if !self.flags.destructure_rewrites {
					return;
				}

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
			_ => {}
		}
		walk::walk_expression(self, &it.right);
	}
}
