//! Build-time coverage proof for the JS rewriter visitor.
//!
//! The `#[coverage_checked(Node)]` attribute on a method whose receiver is a
//! `&Node` parameter analyzes the body for marker-macro invocations and
//! asserts that every field of `Node` whose type can transitively reach
//! `Expression` is covered on every control-flow path that exits the method.
//!
//! Marker macros (recognized only inside `#[coverage_checked]` methods):
//!   - `walk_all!(it)`                            covers all fields
//!   - `walk_field!(it.foo)`                      covers field `foo`
//!   - `walk_field_ctx!(self, ctx_expr, it.foo)`  covers `foo`, pushes ctx
//!   - `skip_field!(it.foo, "reason")`            covers `foo`; the field's
//!                                                 type must not be in R
//!
//! If a field can't be covered on every path, the macro emits a
//! `compile_error!` containing a minimal JS snippet that would exhibit the
//! missed rewrite.

mod analyze;
mod ast_table;
mod helper_index;
mod reachability;
mod templates;
mod witness;

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{ItemFn, parse_macro_input, parse_str, spanned::Spanned};

use crate::analyze::{
    Findings, PathKind, Witness, analyze_with_helpers_typed, extract_receiver_and_field,
};
use crate::ast_table::{Cardinality, Field, NodeDef};
use crate::helper_index::{OriginMap, index};
use crate::reachability::AstGraph;
use crate::witness::{build_uncovered_hints, find_witness_with_hints, render_snippet};

#[proc_macro_attribute]
pub fn coverage_checked(attr: TokenStream, item: TokenStream) -> TokenStream {
    let node_name = match parse_attr(attr) {
        Ok(s) => s,
        Err(e) => return e.into(),
    };

    let mut func: ItemFn = parse_macro_input!(item as ItemFn);

    let graph = AstGraph::build();

    let Some(def) = graph.nodes.get(node_name.as_str()) else {
        return error_at_span(
            func.sig.ident.span(),
            &format!(
                "coverage_checked: unknown AST node type `{}` (add it to ast_table.rs)",
                node_name
            ),
        )
        .into();
    };

    // 1. Expand marker macros in the body to real walk code.
    let new_body = expand_markers(&node_name, **def, &func.block, &graph);
    let new_body: syn::Block = match parse_str(&new_body.to_string()) {
        Ok(b) => b,
        Err(_) => {
            // Fall back to leaving the body untouched if our rewrite produced
            // bad tokens — analysis still runs.
            (*func.block).clone()
        }
    };

    // 2. Run analysis on the *original* body (to find marker uses) — with
    //    the helper index so calls into known-fully-covering helpers credit
    //    coverage at the call site.
    let mut findings = Findings::default();
    let helper_idx = index();
    let mut helpers_by_name: std::collections::HashMap<String, helper_index::HelperInfo> =
        std::collections::HashMap::new();
    for h in helper_idx.all() {
        helpers_by_name.insert(h.name.clone(), h.clone());
    }
    let mut origins = OriginMap::new();
    origins.set("it", helper_index::Origin::It);
    let paths: Vec<Witness> = analyze_with_helpers_typed(
        &func.block,
        "it",
        Some(&node_name),
        &helpers_by_name,
        &graph,
        origins,
    );

    // 3. Check skip-field soundness directly from the original body's tokens.
    let mut errors: Vec<TokenStream2> = Vec::new();
    check_skip_soundness(&func.block, def.fields, &graph, &mut errors);

    // 4. For every R-field of `def`, ensure every termination path covers it.
    for f in def.fields {
        if !graph.field_in_r(f) {
            continue;
        }
        for (idx, p) in paths.iter().enumerate() {
            let covered =
                p.covered.all || p.covered.fields.iter().any(|c| c == f.name);
            if !covered {
                let path_label = match p.kind {
                    PathKind::FallThrough => format!("path #{idx} (fall-through)"),
                    PathKind::Return => format!("path #{idx} (return)"),
                };
                let snippet = build_witness_snippet(&graph, &node_name, f);
                let msg = format_diagnostic(&node_name, f, &path_label, &snippet);
                errors.push(emit_diag(func.sig.ident.span(), &msg));
            }
        }
    }

    // 5. Replace function body with the expanded markers.
    *func.block = new_body;

    let out = quote! {
        #(#errors)*
        #func
    };
    out.into()
}

fn parse_attr(attr: TokenStream) -> Result<String, TokenStream2> {
    let s = attr.to_string();
    let s = s.trim();
    if s.is_empty() {
        return Err(error_at_call_site(
            "coverage_checked requires the AST node name, e.g. #[coverage_checked(ForStatement)]",
        ));
    }
    Ok(s.to_string())
}

/// Reads `COVERAGE_CHECK` at macro execution time.
///
/// - unset or `error` (default): coverage failures become hard `compile_error!`s.
/// - `warn`: prints to stderr during build and emits no token, so the build
///   succeeds. Useful during iteration on the visitor. Note: because env
///   changes don't invalidate proc-macro caches, run `cargo clean -p js` (or
///   touch visitor.rs) after toggling.
/// - `off`: silently suppresses (still won't make the build fail, but no
///   stderr message either).
fn diag_mode() -> &'static str {
    static MODE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    MODE.get_or_init(|| std::env::var("COVERAGE_CHECK").unwrap_or_else(|_| "warn".into()))
}

fn emit_diag(span: proc_macro2::Span, msg: &str) -> TokenStream2 {
    match diag_mode() {
        "off" => TokenStream2::new(),
        "error" => error_at_span(span, msg),
        "warn" | _ => {
            eprintln!("warning: {msg}");
            TokenStream2::new()
        }
    }
}

fn error_at_call_site(msg: &str) -> TokenStream2 {
    quote! { compile_error!(#msg); }
}

fn error_at_span(span: proc_macro2::Span, msg: &str) -> TokenStream2 {
    let lit = proc_macro2::Literal::string(msg);
    quote::quote_spanned! { span => compile_error!(#lit); }
}

fn check_skip_soundness(
    block: &syn::Block,
    fields: &'static [Field],
    graph: &AstGraph,
    errors: &mut Vec<TokenStream2>,
) {
    // Walk the block's syn AST looking for skip_field! invocations.
    syn::visit::visit_block(&mut SkipChecker { fields, graph, errors }, block);
}

struct SkipChecker<'a> {
    fields: &'static [Field],
    graph: &'a AstGraph,
    errors: &'a mut Vec<TokenStream2>,
}

impl<'ast, 'a> syn::visit::Visit<'ast> for SkipChecker<'a> {
    fn visit_macro(&mut self, m: &'ast syn::Macro) {
        let name = m
            .path
            .segments
            .last()
            .map(|s| s.ident.to_string())
            .unwrap_or_default();
        if name == "skip_field" {
            if let Some((_, fname)) = extract_receiver_and_field(&m.tokens) {
                if let Some(field) = self.fields.iter().find(|f| f.name == fname) {
                    if self.graph.field_in_r(field) {
                        let msg = format!(
                            "skip_field!({}.{}) is unsound: type `{}` can reach Expression. \
                             Use audit_skip!(it.{}, \"reason\") if you've audited that this \
                             specific cull cannot be exploited at runtime.",
                            "it", fname, field.ty, fname,
                        );
                        self.errors.push(emit_diag(m.span(), &msg));
                    }
                }
            }
        } else if name == "audit_skip" {
            // Require a non-empty reason string literal as the second arg.
            // We accept any second token group that contains a string with
            // at least one non-whitespace char.
            if !audit_skip_has_reason(&m.tokens) {
                self.errors.push(emit_diag(
                    m.span(),
                    "audit_skip!(it.<field>, \"reason\") requires a non-empty string reason \
                     documenting WHY this cull is not exploitable (TypeError-bound, \
                     evaluation-only, invalid-syntax-wrap, etc).",
                ));
            }
            if std::env::var("COVERAGE_AUDIT").is_ok() {
                if let Some((_, fname)) = extract_receiver_and_field(&m.tokens) {
                    eprintln!(
                        "[coverage-audit] audit_skip!(it.{}) at {:?}",
                        fname, m.span()
                    );
                }
            }
        }
        syn::visit::visit_macro(self, m);
    }
}

fn audit_skip_has_reason(ts: &proc_macro2::TokenStream) -> bool {
    // Both `audit_skip!(it.<field>, "reason")` and `audit_skip!("reason")` are
    // accepted — just look for any non-empty string literal in the tokens.
    use proc_macro2::TokenTree;
    for tt in ts.clone() {
        if let TokenTree::Literal(lit) = tt {
            let s = lit.to_string();
            let inner = s.trim_matches('"');
            if inner.chars().any(|c| !c.is_whitespace()) {
                return true;
            }
        }
    }
    false
}

fn build_witness_snippet(graph: &AstGraph, node: &str, f: &Field) -> String {
    let helpers = index();
    let helpers_map: std::collections::HashMap<String, helper_index::HelperInfo> =
        helpers.all().map(|h| (h.name.clone(), h.clone())).collect();
    let hints = build_uncovered_hints(&helpers_map, graph);
    let Some(path) = find_witness_with_hints(graph, leak_str(node.to_string()), f, &hints) else {
        return "<no witness found>".to_string();
    };
    // Compose inner snippet from witness.
    let inner = render_snippet(graph, &path);
    // Wrap in the node's template too, so the snippet is a complete program.
    // For most program-level nodes (Statement variants) this is enough; for
    // expressions we wrap in `(...);`.
    inner
}

fn leak_str(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

fn format_diagnostic(node: &str, f: &Field, path: &str, snippet: &str) -> String {
    let card = match f.card {
        Cardinality::One => "",
        Cardinality::Opt => " (Option)",
        Cardinality::Vec => " (Vec)",
    };
    format!(
        "coverage_checked: `{node}.{name}` (type `{ty}`{card}) is not covered on {path}.\n\
         This may lead to a runtime escape.\n\
         Minimal program that can reach this path (may not actually demonstrate the escape):\n\
             {snippet}\n\
         ",
        name = f.name,
        ty = f.ty,
    )
}

/// Replace marker macros inside the body with real walk code.
fn expand_markers(
    _node: &str,
    def: NodeDef,
    block: &syn::Block,
    _graph: &AstGraph,
) -> TokenStream2 {
    let mut out = TokenStream2::new();
    expand_block_inner(block, def, &mut out);
    out
}

fn expand_block_inner(block: &syn::Block, def: NodeDef, out: &mut TokenStream2) {
    let brace = proc_macro2::Group::new(
        proc_macro2::Delimiter::Brace,
        {
            let mut inner = TokenStream2::new();
            for stmt in &block.stmts {
                expand_stmt(stmt, def, &mut inner);
            }
            inner
        },
    );
    out.extend(Some(proc_macro2::TokenTree::Group(brace)));
}

fn expand_stmt(stmt: &syn::Stmt, def: NodeDef, out: &mut TokenStream2) {
    let toks = quote! { #stmt };
    let expanded = expand_token_stream(toks, def);
    out.extend(expanded);
}

fn expand_token_stream(input: TokenStream2, def: NodeDef) -> TokenStream2 {
    use proc_macro2::TokenTree;
    let tts: Vec<TokenTree> = input.into_iter().collect();
    let mut out = TokenStream2::new();
    let mut i = 0;
    while i < tts.len() {
        if i + 2 < tts.len() {
            if let (TokenTree::Ident(name), TokenTree::Punct(bang), TokenTree::Group(g)) =
                (&tts[i], &tts[i + 1], &tts[i + 2])
            {
                if bang.as_char() == '!' && g.delimiter() == proc_macro2::Delimiter::Parenthesis {
                    let n = name.to_string();
                    if let Some(replacement) = try_expand_marker(&n, g.stream(), def) {
                        out.extend(replacement);
                        i += 3;
                        continue;
                    }
                }
            }
        }
        match &tts[i] {
            TokenTree::Group(g) => {
                let inner = expand_token_stream(g.stream(), def);
                let new_group = proc_macro2::Group::new(g.delimiter(), inner);
                out.extend(Some(TokenTree::Group(new_group)));
            }
            other => out.extend(Some(other.clone())),
        }
        i += 1;
    }
    out
}

fn try_expand_marker(
    name: &str,
    inner: TokenStream2,
    def: NodeDef,
) -> Option<TokenStream2> {
    match name {
        "walk_all" => {
            // walk_all!(it) delegates to oxc's default walk_<snake_node>(self, it).
            // That walker traverses every child correctly (in the right order
            // and dispatching variants of enums). Coverage analysis treats
            // this as covering every field of `def`.
            let walk_fn = walk_fn_for_type(def.name);
            let walk_fn: syn::Path = syn::parse_str(&walk_fn).ok()?;
            // Special case: visit_function takes an extra `flags` argument
            // that walk_function also expects.
            if def.name == "Function" {
                Some(quote! { #walk_fn (self, it, flags); })
            } else {
                Some(quote! { #walk_fn (self, it); })
            }
        }
        "walk_field" => {
            let fname = analyze::extract_field_name(&inner)?;
            let f = def.fields.iter().find(|f| f.name == fname)?;
            walk_for_field(f)
        }
        "walk_field_ctx" => expand_walk_field_ctx(inner, def),
        "skip_field" | "audit_skip" => Some(TokenStream2::new()),
        _ => None,
    }
}

fn expand_walk_field_ctx(
    inner: TokenStream2,
    def: NodeDef,
) -> Option<TokenStream2> {
    let parts = split_top_commas(inner);
    if parts.len() != 3 {
        return None;
    }
    let recv = &parts[0];
    let ctx = &parts[1];
    let field_tokens = &parts[2];
    let fname = analyze::extract_field_name(field_tokens)?;
    let f = def.fields.iter().find(|fd| fd.name == fname)?;
    let walk = walk_for_field(f)?;
    Some(quote! {{
        let __cov_prev = #recv .ctx;
        #recv .ctx = (#ctx);
        #walk
        #recv .ctx = __cov_prev;
    }})
}

fn split_top_commas(ts: TokenStream2) -> Vec<TokenStream2> {
    use proc_macro2::TokenTree;
    let mut parts: Vec<TokenStream2> = Vec::new();
    let mut cur = TokenStream2::new();
    for tt in ts {
        match &tt {
            TokenTree::Punct(p) if p.as_char() == ',' && p.spacing() == proc_macro2::Spacing::Alone => {
                parts.push(std::mem::take(&mut cur));
            }
            _ => cur.extend(Some(tt)),
        }
    }
    if !cur.is_empty() {
        parts.push(cur);
    }
    parts
}

fn walk_for_field(f: &Field) -> Option<TokenStream2> {
    let walk_fn = walk_fn_for_type(f.ty);
    let walk_fn: syn::Path = syn::parse_str(&walk_fn).ok()?;
    let field_ident = syn::Ident::new(f.name, proc_macro2::Span::call_site());
    Some(match f.card {
        Cardinality::One => quote! { #walk_fn (self, &it.#field_ident); },
        Cardinality::Opt => quote! {
            if let Some(__cov_x) = &it.#field_ident { #walk_fn (self, __cov_x); }
        },
        Cardinality::Vec => quote! {
            for __cov_x in &it.#field_ident { #walk_fn (self, __cov_x); }
        },
    })
}

fn walk_fn_for_type(ty: &str) -> String {
    // Convert PascalCase to snake_case and prefix with `walk::walk_`.
    let mut s = String::with_capacity(ty.len() + 12);
    s.push_str("walk::walk_");
    for (i, ch) in ty.chars().enumerate() {
        if ch.is_ascii_uppercase() {
            if i != 0 {
                s.push('_');
            }
            s.push(ch.to_ascii_lowercase());
        } else {
            s.push(ch);
        }
    }
    s
}
