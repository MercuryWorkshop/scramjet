//! Coverage analysis with helper recursion.
//!
//! For each `#[coverage_checked]` method (and each helper indexed from
//! visitor.rs), we compute the set of R-reaching fields covered on every
//! control-flow path that exits the method. Coverage is contributed by:
//!
//!   - The marker macros `walk_all!(it)`, `walk_field!(it.foo)`,
//!     `skip_field!(it.foo, "…")`.
//!   - Bare `walk::walk_*(self, it)` / `walk::walk_*(self, &it.foo)` calls.
//!   - Calls to helper methods that the index has proven to fully cover
//!     their AST arguments — the call credits the corresponding field at
//!     the call site (via origin tracking on local bindings).
//!
//! Control flow:
//!   - sequential stmts → union
//!   - if/else → intersect at merge (no-else branch contributes nothing)
//!   - match → intersect across arms
//!   - return / unreachable / panic / ? → terminate; check coverage there
//!   - loops → body might run 0 times; conservative = body's covers don't
//!     count toward post-loop coverage. (But field credits FROM the loop
//!     itself — i.e. covering `it.foo` because the loop iterates `it.foo`
//!     and processes every element — DO count.)

use std::collections::{BTreeSet, HashMap};

use proc_macro2::TokenStream;
use syn::{Block, Expr, ExprForLoop, ExprIf, ExprMatch, Pat, Stmt};

use crate::helper_index::{
    Binding, HelperInfo, Origin, OriginMap, iter_element_type, origin_from_iter, resolve_origin,
    resolve_type,
};
use crate::reachability::AstGraph;

#[derive(Clone, Debug)]
pub struct Covered {
    pub all: bool,
    pub fields: BTreeSet<String>,
}

impl Covered {
    pub fn empty() -> Self { Self { all: false, fields: BTreeSet::new() } }
    pub fn full()  -> Self { Self { all: true,  fields: BTreeSet::new() } }
    pub fn add_field(&mut self, name: &str) { self.fields.insert(name.to_string()); }
    pub fn intersect(a: &Self, b: &Self) -> Self {
        if a.all && b.all { return Self::full(); }
        let af: BTreeSet<String> = if a.all { b.fields.clone() } else { a.fields.clone() };
        let bf: BTreeSet<String> = if b.all { a.fields.clone() } else { b.fields.clone() };
        Self { all: a.all && b.all, fields: af.intersection(&bf).cloned().collect() }
    }
    pub fn covers(&self, name: &str) -> bool {
        self.all || self.fields.iter().any(|f| f == name)
    }
}

#[derive(Clone, Debug)]
pub struct Witness {
    pub kind: PathKind,
    pub covered: Covered,
}

#[derive(Clone, Debug)]
pub enum PathKind { FallThrough, Return }

#[derive(Default)]
pub struct Findings {
    pub missing: Vec<MissingCover>,
    pub bad_skips: Vec<BadSkip>,
}

#[derive(Clone, Debug)]
pub struct MissingCover {
    pub field: String,
    pub field_ty: String,
    pub path_label: String,
}

#[derive(Clone, Debug)]
pub struct BadSkip {
    pub field: String,
    pub field_ty: String,
    pub site_repr: String,
}

/// Backward-compatible entry — used when no helper index is available.
pub fn analyze(body: &Block, _findings: &mut Findings, graph: &AstGraph) -> Vec<Witness> {
    let helpers = HashMap::new();
    let origins = OriginMap::new();
    analyze_with_helpers_typed(body, "it", None, &helpers, graph, origins)
}

pub fn analyze_with_helpers(
    body: &Block,
    it_name: &str,
    helpers: &HashMap<String, HelperInfo>,
    graph: &AstGraph,
    origins: OriginMap,
) -> Vec<Witness> {
    analyze_with_helpers_typed(body, it_name, None, helpers, graph, origins)
}

pub fn analyze_with_helpers_typed(
    body: &Block,
    it_name: &str,
    it_node_type: Option<&str>,
    helpers: &HashMap<String, HelperInfo>,
    graph: &AstGraph,
    mut origins: OriginMap,
) -> Vec<Witness> {
    // Seed `it`'s binding with its type so resolve_type / enum-coverage on
    // `it`-rooted expressions can find the right NodeDef.
    if let Some(t) = it_node_type {
        origins.set_binding(it_name, Binding::it(Some(t.to_string())));
    }
    let mut completed: Vec<Witness> = Vec::new();
    let ctx = Ctx { it_name, it_node_type, helpers, graph };
    let final_cov = walk_block(body, Covered::empty(), origins, &mut completed, &ctx);
    completed.push(Witness { kind: PathKind::FallThrough, covered: final_cov });
    completed
}

struct Ctx<'a> {
    it_name: &'a str,
    it_node_type: Option<&'a str>,
    helpers: &'a HashMap<String, HelperInfo>,
    graph: &'a AstGraph,
}

fn walk_block(
    block: &Block,
    mut cov: Covered,
    mut origins: OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Covered {
    for stmt in &block.stmts {
        let out = walk_stmt(stmt, cov.clone(), &mut origins, completed, ctx);
        match out {
            Out::Continue(c) => cov = c,
            Out::Terminated => return Covered::full(),
        }
    }
    cov
}

enum Out { Continue(Covered), Terminated }

fn walk_stmt(
    stmt: &Stmt,
    cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Out {
    match stmt {
        Stmt::Expr(e, _) => walk_expr_stmt(e, cov, origins, completed, ctx),
        Stmt::Local(loc) => {
            if let Some(init) = &loc.init {
                let (new_cov, terminated) = inspect_expr(&init.expr, cov.clone(), origins, completed, ctx);
                if let Pat::Ident(pid) = &loc.pat {
                    let name = pid.ident.to_string();
                    let origin = resolve_origin(&init.expr, origins, ctx.it_name);
                    let ty = resolve_type(&init.expr, origins, ctx.it_name, ctx.it_node_type, ctx.graph);
                    origins.set_binding(&name, Binding { origin, ast_type: ty });
                }
                if terminated { return Out::Terminated; }
                return Out::Continue(new_cov);
            }
            Out::Continue(cov)
        }
        Stmt::Item(_) => Out::Continue(cov),
        Stmt::Macro(m) => Out::Continue(handle_macro_invocation(&m.mac, cov)),
    }
}

fn walk_expr_stmt(
    expr: &Expr,
    cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Out {
    let (new_cov, terminated) = inspect_expr(expr, cov, origins, completed, ctx);
    if terminated { Out::Terminated } else { Out::Continue(new_cov) }
}

fn inspect_expr(
    expr: &Expr,
    mut cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> (Covered, bool) {
    match expr {
        Expr::Return(_) => {
            completed.push(Witness { kind: PathKind::Return, covered: cov });
            (Covered::full(), true)
        }
        Expr::Break(_) | Expr::Continue(_) => {
            // Abnormal terminator — control leaves the current arm/loop
            // body without producing a fall-through value. We don't record
            // a coverage witness, because the caller never observes a
            // partially-rewritten state through this path: any rewrites
            // already pushed into the bag are still emitted; nothing
            // downstream from here would have run.
            (Covered::full(), true)
        }
        Expr::Try(t) => {
            // `expr?` — the Err path returns Err to the function caller
            // without observable partial state at this point (rewrites
            // already pushed remain). Don't record a witness; continue
            // analyzing the Ok path through the inner expression.
            return inspect_expr(&t.expr, cov, origins, completed, ctx);
        }
        Expr::Macro(m) => {
            if is_terminating_macro(&m.mac) {
                // panic!() / unreachable!() / todo!() / unimplemented!() —
                // function aborts. Same as Break/Continue: no observable
                // partial state, no witness recorded.
                return (Covered::full(), true);
            }
            (handle_macro_invocation(&m.mac, cov), false)
        }
        Expr::If(eif) => (walk_if(eif, cov, origins, completed, ctx), false),
        Expr::Match(em) => (walk_match(em, cov, origins, completed, ctx), false),
        Expr::Block(b) => (walk_block(&b.block, cov, origins.clone(), completed, ctx), false),
        Expr::Unsafe(b) => (walk_block(&b.block, cov, origins.clone(), completed, ctx), false),
        Expr::ForLoop(efl) => {
            cov = walk_for_loop(efl, cov, origins.clone(), completed, ctx);
            (cov, false)
        }
        Expr::While(ew) => {
            // While-body may run zero times. Don't merge body cov into outer.
            // But field credits emitted directly by the loop iterator (e.g.
            // `for v in &it.foo`) DO count via walk_for_loop. While doesn't
            // have that pattern, so just walk the body for its own assertions.
            let _ = walk_block(&ew.body, cov.clone(), origins.clone(), completed, ctx);
            (cov, false)
        }
        Expr::Loop(el) => {
            let _ = walk_block(&el.body, cov.clone(), origins.clone(), completed, ctx);
            (cov, false)
        }
        Expr::Call(call) => {
            cov = handle_call(call, cov, origins, ctx);
            (cov, false)
        }
        Expr::MethodCall(mc) => {
            cov = handle_method_call(mc, cov, origins, ctx);
            (cov, false)
        }
        Expr::Let(_) => (cov, false),
        Expr::Assign(a) => {
            let (c, _) = inspect_expr(&a.right, cov, origins, completed, ctx);
            (c, false)
        }
        _ => (cov, false),
    }
}

fn walk_if(
    eif: &ExprIf,
    cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Covered {
    // Detect `if let Pat = scrutinee { ... }` and update origins inside then.
    let mut then_origins = origins.clone();
    let mut scrut_field: Option<String> = None;
    let mut scrut_type: Option<String> = None;
    let mut scrut_origin = Origin::Unknown;
    let mut scrut_variant: Option<String> = None;
    let mut scrut_expr_for_if_let: Option<&Expr> = None;
    if let Expr::Let(el) = eif.cond.as_ref() {
        bind_pattern_origins(&el.pat, &el.expr, &mut then_origins, ctx);
        scrut_origin = resolve_origin(&el.expr, origins, ctx.it_name);
        if let Origin::Field(name) = &scrut_origin {
            scrut_field = Some(name.clone());
        }
        scrut_type = resolve_type(&el.expr, origins, ctx.it_name, ctx.it_node_type, ctx.graph);
        scrut_variant = pattern_variant_name(&el.pat, ctx);
        scrut_expr_for_if_let = Some(&el.expr);
    }
    let then_cov = walk_block(&eif.then_branch, cov.clone(), then_origins, completed, ctx);
    // Enum-aware if-let-else: when cond is `if let EnumType::Variant(v) = scrut`
    // and else handles the remaining variants, treat the whole if-else as
    // covering the enum.
    if let (Some(variant), Some(ty), Some(scrut_e)) =
        (&scrut_variant, &scrut_type, scrut_expr_for_if_let)
    {
        if let Some(def) = ctx.graph.nodes.get(ty.as_str()) {
            if !def.variants.is_empty() {
                // Variant covered iff then-branch covers it (we check by
                // seeing if the then-branch's coverage of v's binding type
                // is complete — equivalent to running an arm-coverage check).
                let variant_covered = if_let_variant_covered(
                    &then_cov,
                    &eif.then_branch,
                    variant,
                    scrut_e,
                    ctx,
                );

                // Other variants covered iff else-branch fully covers them.
                let other_variants_covered = else_covers_other_variants(
                    eif.else_branch.as_ref().map(|(_, e)| e.as_ref()),
                    ty.as_str(),
                    variant,
                    scrut_e,
                    cov.clone(),
                    origins,
                    completed,
                    ctx,
                );

                if variant_covered && other_variants_covered {
                    let mut c = cov;
                    // Also retain whatever the then-branch added beyond
                    // variant-level (e.g. unrelated walks).
                    if then_cov.all {
                        c.all = true;
                    } else {
                        for f in &then_cov.fields {
                            c.fields.insert(f.clone());
                        }
                    }
                    if let Some(field_name) = &scrut_field {
                        c.add_field(field_name);
                    } else if matches!(scrut_origin, Origin::It) {
                        c.all = true;
                    }
                    return c;
                }
            }
        }
    }

    match &eif.else_branch {
        Some((_, e)) => {
            let else_cov = match e.as_ref() {
                Expr::Block(b) => {
                    walk_block(&b.block, cov.clone(), origins.clone(), completed, ctx)
                }
                Expr::If(inner) => walk_if(inner, cov.clone(), origins, completed, ctx),
                _ => cov.clone(),
            };
            Covered::intersect(&then_cov, &else_cov)
        }
        None => {
            if let Some(f) = &scrut_field {
                let mut c = then_cov;
                c.add_field(f);
                c
            } else {
                cov
            }
        }
    }
}

/// Extract the variant name from an if-let pattern. Returns None for
/// non-variant patterns (Some(_), generic Or-patterns, etc.).
fn pattern_variant_name(pat: &Pat, ctx: &Ctx) -> Option<String> {
    match pat {
        Pat::TupleStruct(ts) => {
            let last = ts.path.segments.last()?.ident.to_string();
            // Only return a variant name we know to be an AST type — that
            // way `Some(...)` (where `Some` isn't in our table) doesn't
            // trigger enum-aware coverage.
            if ctx.graph.nodes.contains_key(last.as_str()) {
                Some(last)
            } else {
                None
            }
        }
        Pat::Struct(s) => {
            let last = s.path.segments.last()?.ident.to_string();
            if ctx.graph.nodes.contains_key(last.as_str()) {
                Some(last)
            } else {
                None
            }
        }
        Pat::Reference(r) => pattern_variant_name(&r.pat, ctx),
        Pat::Paren(p) => pattern_variant_name(&p.pat, ctx),
        _ => None,
    }
}

fn if_let_variant_covered(
    then_cov: &Covered,
    then_block: &Block,
    variant: &str,
    scrut_expr: &Expr,
    ctx: &Ctx,
) -> bool {
    // If the then-block's coverage of the outer it includes this variant
    // name (credited by a helper that fully covers the variant's type) OR
    // cov.all is set, the variant is covered.
    if then_cov.all { return true; }
    if then_cov.fields.iter().any(|n| n == variant) { return true; }
    // Fallback: scan for a helper call on the scrutinee that covers this
    // variant (handles `if let V(_) = scrut { self.h(scrut) }` patterns).
    if scan_block_for_helper_on(then_block, scrut_expr, variant, ctx) {
        return true;
    }
    false
}

fn else_covers_other_variants(
    else_expr: Option<&Expr>,
    enum_ty: &str,
    matched_variant: &str,
    scrut_expr: &Expr,
    cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> bool {
    let Some(else_expr) = else_expr else { return false };
    let Some(def) = ctx.graph.nodes.get(enum_ty) else { return false };

    // Run the else-branch analysis to gather its coverage / variant credits.
    let else_block = match else_expr {
        Expr::Block(b) => b.block.clone(),
        Expr::If(inner) => {
            // chained `else if let ...` — wrap as a block stmt and recurse.
            syn::Block {
                brace_token: Default::default(),
                stmts: vec![Stmt::Expr(Expr::If(inner.clone()), None)],
            }
        }
        other => syn::Block {
            brace_token: Default::default(),
            stmts: vec![Stmt::Expr(other.clone(), None)],
        },
    };
    let else_cov = walk_block(&else_block, cov, origins.clone(), completed, ctx);

    // For each other R-variant of the enum, check whether it's covered by
    // the else branch — either:
    //   - else_cov.all
    //   - else_cov.fields contains the variant name (variant-level credit
    //     bubbled up from an inner match's enum-aware analysis)
    //   - the else body has a helper call on scrut_expr whose covered_set
    //     contains the variant.
    for v in def.variants {
        if !ctx.graph.in_r(v) { continue; }
        if *v == matched_variant { continue; }
        if else_cov.all { continue; }
        if else_cov.fields.iter().any(|n| n == v) { continue; }
        if scan_block_for_helper_on(&else_block, scrut_expr, v, ctx) { continue; }
        return false;
    }
    true
}

fn scan_block_for_helper_on(
    block: &Block,
    scrut_expr: &Expr,
    variant: &str,
    ctx: &Ctx,
) -> bool {
    let scrut_repr = expr_canonical(scrut_expr);
    let mut hit = false;
    for stmt in &block.stmts {
        if let Stmt::Expr(e, _) = stmt {
            scan_helper_calls(e, &mut |mc| {
                let Expr::Path(p) = mc.receiver.as_ref() else { return };
                if !p.path.is_ident("self") { return; }
                let name = mc.method.to_string();
                let Some(info) = ctx.helpers.get(&name) else { return };
                if !info.covered_set.contains(variant) && !info.covered_all { return; }
                let Some(arg0) = mc.args.first() else { return };
                if expr_canonical(arg0) == scrut_repr || ref_canonical(arg0) == scrut_repr {
                    hit = true;
                }
            });
        }
        if hit { break; }
    }
    hit
}

fn walk_match(
    em: &ExprMatch,
    cov: Covered,
    origins: &mut OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Covered {
    // Enum-aware coverage. The scrutinee can be:
    //   - `&it.<field>` → if field's type is an enum, full match coverage
    //     credits the field name in `base`.
    //   - `it` itself (Origin::It) → if `it`'s type is an enum, full match
    //     coverage promotes `base.all = true`.
    //   - any local with a known enum AST type (via Binding's `ast_type`)
    //     → same as Origin::It case at that local's level.
    let scrut_origin = resolve_origin(&em.expr, origins, ctx.it_name);
    let scrut_field = match &scrut_origin {
        Origin::Field(name) => Some(name.clone()),
        _ => None,
    };
    let scrut_type =
        resolve_type(&em.expr, origins, ctx.it_name, ctx.it_node_type, ctx.graph);

    let mut arm_covs = Vec::new();
    for arm in &em.arms {
        let mut arm_origins = origins.clone();
        bind_pattern_origins(&arm.pat, &em.expr, &mut arm_origins, ctx);
        let mut arm_cov = cov.clone();
        match arm.body.as_ref() {
            Expr::Block(b) => {
                arm_cov = walk_block(&b.block, arm_cov, arm_origins, completed, ctx);
            }
            other => {
                let (c, terminated) = inspect_expr(other, arm_cov.clone(), &mut arm_origins, completed, ctx);
                arm_cov = if terminated { Covered::full() } else { c };
            }
        }
        arm_covs.push(arm_cov);
    }

    let mut base = {
        let mut it = arm_covs.clone().into_iter();
        let first = it.next().unwrap_or_else(Covered::full);
        it.fold(first, |acc, c| Covered::intersect(&acc, &c))
    };

    // Enum-aware promotion using the scrutinee's actual AST type.
    if let Some(t) = scrut_type.as_deref() {
        if let Some(def) = ctx.graph.nodes.get(t) {
            if !def.variants.is_empty() {
                let mut all_covered = true;
                for v in def.variants {
                    if !ctx.graph.in_r(v) {
                        continue;
                    }
                    let arm = find_arm_for_variant(em, v);
                    let covered = arm
                        .map(|a| arm_covers_variant(a, v, &em.expr, ctx))
                        .unwrap_or(false);
                    if covered {
                        base.add_field(v);
                    } else {
                        all_covered = false;
                    }
                }
                if all_covered {
                    if let Some(field_name) = &scrut_field {
                        base.add_field(field_name);
                    } else if matches!(scrut_origin, Origin::It) {
                        base.all = true;
                    }
                }
            }
        }
    }

    base
}


#[allow(dead_code)]
fn check_match_covers_enum(
    em: &ExprMatch,
    enum_def: &crate::ast_table::NodeDef,
    ctx: &Ctx,
) -> bool {
    use crate::ast_table::NodeDef;

    // Build the set of R-variants we need to cover.
    let mut needed: Vec<&str> = Vec::new();
    for v in enum_def.variants {
        if ctx.graph.in_r(v) {
            needed.push(*v);
        }
    }

    // For each variant, find an arm that matches it and check its body covers V.
    for variant in &needed {
        let arm = find_arm_for_variant(em, variant);
        let Some(arm) = arm else { return false; };
        if !arm_covers_variant(arm, variant, &em.expr, ctx) {
            return false;
        }
    }
    let _: &NodeDef = enum_def;
    true
}

/// Find the first arm whose pattern matches `variant`. A wildcard arm
/// matches everything.
fn find_arm_for_variant<'a>(em: &'a ExprMatch, variant: &str) -> Option<&'a syn::Arm> {
    for arm in &em.arms {
        if arm_matches_variant(&arm.pat, variant) {
            return Some(arm);
        }
    }
    None
}

fn arm_matches_variant(pat: &Pat, variant: &str) -> bool {
    match pat {
        Pat::Wild(_) => true,
        Pat::Ident(p) if p.ident == "_" => true,
        Pat::TupleStruct(ts) => {
            // Path like `T::Variant(_)` or `Variant(_)`.
            ts.path
                .segments
                .last()
                .map(|s| s.ident == variant)
                .unwrap_or(false)
        }
        Pat::Path(p) => p
            .path
            .segments
            .last()
            .map(|s| s.ident == variant)
            .unwrap_or(false),
        Pat::Struct(s) => s
            .path
            .segments
            .last()
            .map(|s| s.ident == variant)
            .unwrap_or(false),
        Pat::Or(o) => o.cases.iter().any(|c| arm_matches_variant(c, variant)),
        Pat::Paren(p) => arm_matches_variant(&p.pat, variant),
        Pat::Reference(r) => arm_matches_variant(&r.pat, variant),
        _ => false,
    }
}

fn arm_covers_variant(
    arm: &syn::Arm,
    variant: &str,
    scrut_expr: &Expr,
    ctx: &Ctx,
) -> bool {
    let v_def = ctx.graph.nodes.get(variant);
    let binding = extract_arm_binding(&arm.pat);

    // Wildcard / multi-variant arm with no specific binding: the body might
    // still cover the variant if it (a) is trivially-covered by virtue of
    // having no R-content, (b) calls a helper on the original scrutinee that
    // covers this variant, or (c) contains `audit_skip!("...")` documenting
    // a runtime-safe cull.
    if binding.is_none() {
        if let Some(d) = v_def {
            let has_r_field = d.fields.iter().any(|f| ctx.graph.field_in_r(f));
            let has_r_variant = d.variants.iter().any(|v| ctx.graph.in_r(v));
            if !has_r_field && !has_r_variant {
                return true;
            }
        }
        // Run a mini analyze on the arm body so audit_skip!/walks on the
        // outer scope (rare) are picked up. cov.all suffices.
        let body_block = match arm.body.as_ref() {
            Expr::Block(b) => b.block.clone(),
            other => syn::Block {
                brace_token: Default::default(),
                stmts: vec![Stmt::Expr(other.clone(), None)],
            },
        };
        let paths = analyze_with_helpers_typed(
            &body_block,
            ctx.it_name,
            ctx.it_node_type,
            ctx.helpers,
            ctx.graph,
            OriginMap::new(),
        );
        if paths.iter().all(|p| p.covered.all) {
            return true;
        }
        // Otherwise fall back to the helper-on-scrutinee check.
        return body_covers_variant_via_helper(arm, scrut_expr, variant, ctx);
    }

    let bname = binding.unwrap();
    let Some(v_def) = v_def else { return false };

    // Run a mini analyze on the arm body, with `bname` as the new "it" and
    // v_def as the target type. This credits walks/helpers on `bname`.
    let body_block = match arm.body.as_ref() {
        Expr::Block(b) => b.block.clone(),
        other => syn::Block {
            brace_token: Default::default(),
            stmts: vec![Stmt::Expr(other.clone(), None)],
        },
    };
    let mut origins = OriginMap::new();
    origins.set_binding(&bname, Binding::it(Some(variant.to_string())));
    let paths = analyze_with_helpers_typed(
        &body_block,
        &bname,
        Some(variant),
        ctx.helpers,
        ctx.graph,
        origins,
    );

    for p in &paths {
        if !p.covered.all {
            if v_def.fields.is_empty() && !v_def.variants.is_empty() {
                return false;
            }
            for f in v_def.fields {
                if !ctx.graph.field_in_r(f) {
                    continue;
                }
                if !p.covered.fields.iter().any(|n| n == f.name) {
                    return false;
                }
            }
        }
    }
    true
}

/// Scan an arm's body for a `self.helper(scrut_expr)` call where the helper's
/// covered_set contains `variant`. This is what makes
///   StaticMember(_) | ComputedMember(_) => self.handle_assignment_target_member(target)
/// cover those variants when `target` IS the match scrutinee.
fn body_covers_variant_via_helper(
    arm: &syn::Arm,
    scrut_expr: &Expr,
    variant: &str,
    ctx: &Ctx,
) -> bool {
    // Compare expressions structurally for "same as scrut_expr."
    let scrut_repr = expr_canonical(scrut_expr);
    let body = arm.body.as_ref();
    let mut hit = false;
    scan_helper_calls(body, &mut |mc| {
        // Receiver must be `self`.
        let Expr::Path(p) = mc.receiver.as_ref() else { return };
        if !p.path.is_ident("self") { return; }
        let name = mc.method.to_string();
        let Some(info) = ctx.helpers.get(&name) else { return };
        // The helper must cover the variant.
        if !info.covered_set.contains(variant) && !info.covered_all { return; }
        // First arg must be the scrutinee (or an &-ref to it).
        let Some(arg0) = mc.args.first() else { return };
        if expr_canonical(arg0) == scrut_repr || ref_canonical(arg0) == scrut_repr {
            hit = true;
        }
    });
    hit
}

fn expr_canonical(e: &Expr) -> String {
    use quote::ToTokens;
    e.to_token_stream().to_string()
}

fn ref_canonical(e: &Expr) -> String {
    if let Expr::Reference(r) = e {
        return expr_canonical(&r.expr);
    }
    expr_canonical(e)
}

fn scan_helper_calls<F: FnMut(&syn::ExprMethodCall)>(e: &Expr, f: &mut F) {
    match e {
        Expr::MethodCall(m) => {
            f(m);
            scan_helper_calls(&m.receiver, f);
            for a in &m.args { scan_helper_calls(a, f); }
        }
        Expr::Call(c) => {
            scan_helper_calls(&c.func, f);
            for a in &c.args { scan_helper_calls(a, f); }
        }
        Expr::Block(b) => {
            for s in &b.block.stmts {
                if let Stmt::Expr(e, _) = s { scan_helper_calls(e, f); }
            }
        }
        Expr::If(eif) => {
            for s in &eif.then_branch.stmts {
                if let Stmt::Expr(e, _) = s { scan_helper_calls(e, f); }
            }
            if let Some((_, els)) = &eif.else_branch { scan_helper_calls(els, f); }
        }
        Expr::Match(em) => {
            for arm in &em.arms { scan_helper_calls(&arm.body, f); }
        }
        Expr::Paren(p) => scan_helper_calls(&p.expr, f),
        Expr::Reference(r) => scan_helper_calls(&r.expr, f),
        _ => {}
    }
}

fn extract_arm_binding(pat: &Pat) -> Option<String> {
    match pat {
        Pat::Ident(p) if p.ident == "_" => None,
        Pat::Ident(p) => Some(p.ident.to_string()),
        Pat::TupleStruct(ts) => {
            if let Some(inner) = ts.elems.first() {
                return extract_arm_binding(inner);
            }
            None
        }
        Pat::Tuple(t) => {
            if let Some(inner) = t.elems.first() {
                return extract_arm_binding(inner);
            }
            None
        }
        Pat::Struct(s) => {
            if let Some(f) = s.fields.first() {
                return extract_arm_binding(&f.pat);
            }
            None
        }
        Pat::Reference(r) => extract_arm_binding(&r.pat),
        Pat::Paren(p) => extract_arm_binding(&p.pat),
        Pat::Wild(_) => None,
        _ => None,
    }
}

fn walk_for_loop(
    efl: &ExprForLoop,
    mut cov: Covered,
    mut origins: OriginMap,
    completed: &mut Vec<Witness>,
    ctx: &Ctx,
) -> Covered {
    // Bind loop var → origin & element-type of iter.
    if let Pat::Ident(pid) = efl.pat.as_ref() {
        let name = pid.ident.to_string();
        let origin = origin_from_iter(&efl.expr, &origins, ctx.it_name);
        let ty = iter_element_type(&efl.expr, &origins, ctx.it_name, ctx.it_node_type, ctx.graph);
        origins.set_binding(&name, Binding { origin, ast_type: ty });
    }
    // The loop body runs over EVERY element. If the body fully covers each
    // element, the parent field IS covered. We detect this by running the
    // body and observing whether any field credits from `it.<field>` appear
    // via the loop variable's origin propagating to walks/helpers inside.
    let body_cov = walk_block(&efl.body, Covered::empty(), origins.clone(), completed, ctx);
    // Promote body covers up: anything credited in the body during this loop
    // applies to the outer cov as well (since the iteration covers ALL items
    // when the loop iterates over an `it.<field>` collection).
    if body_cov.all {
        cov.all = true;
    } else {
        for f in &body_cov.fields {
            cov.fields.insert(f.clone());
        }
    }
    cov
}

/// Bind locals from a pattern matched against a scrutinee expression. Used
/// for `if let`, `match`, and similar. Handles common pattern shapes and
/// derives variant types from `EnumPath::Variant(binding)` shapes.
fn bind_pattern_origins(
    pat: &Pat,
    scrut: &Expr,
    origins: &mut OriginMap,
    ctx: &Ctx,
) {
    let scrut_origin = resolve_origin(scrut, origins, ctx.it_name);
    let scrut_type = resolve_type(scrut, origins, ctx.it_name, ctx.it_node_type, ctx.graph);
    bind_pat_with(pat, &scrut_origin, scrut_type.as_deref(), origins, ctx);
}

fn bind_pat_with(
    pat: &Pat,
    origin: &Origin,
    scrut_ty: Option<&str>,
    origins: &mut OriginMap,
    ctx: &Ctx,
) {
    match pat {
        Pat::Ident(p) => {
            origins.set_binding(
                &p.ident.to_string(),
                Binding { origin: origin.clone(), ast_type: scrut_ty.map(String::from) },
            );
            if let Some((_, sub)) = &p.subpat {
                bind_pat_with(sub, origin, scrut_ty, origins, ctx);
            }
        }
        Pat::Reference(r) => bind_pat_with(&r.pat, origin, scrut_ty, origins, ctx),
        Pat::TupleStruct(ts) => {
            // Variant pattern: the binding(s) inside the tuple-struct carry
            // the variant's type, not the enum's type.
            let variant_name = ts.path.segments.last().map(|s| s.ident.to_string());
            let variant_ty = variant_name
                .as_deref()
                .filter(|n| ctx.graph.nodes.contains_key(*n))
                .map(String::from);
            let inner_ty = variant_ty.as_deref().or(scrut_ty);
            for elem in &ts.elems {
                bind_pat_with(elem, origin, inner_ty, origins, ctx);
            }
        }
        Pat::Tuple(t) => {
            for elem in &t.elems {
                bind_pat_with(elem, origin, scrut_ty, origins, ctx);
            }
        }
        Pat::Struct(s) => {
            let variant_name = s.path.segments.last().map(|s| s.ident.to_string());
            let variant_ty = variant_name
                .as_deref()
                .filter(|n| ctx.graph.nodes.contains_key(*n))
                .map(String::from);
            let inner_ty = variant_ty.as_deref().or(scrut_ty);
            for f in &s.fields {
                bind_pat_with(&f.pat, origin, inner_ty, origins, ctx);
            }
        }
        Pat::Or(o) => {
            for case in &o.cases {
                bind_pat_with(case, origin, scrut_ty, origins, ctx);
            }
        }
        Pat::Paren(p) => bind_pat_with(&p.pat, origin, scrut_ty, origins, ctx),
        Pat::Slice(s) => {
            for elem in &s.elems {
                bind_pat_with(elem, origin, scrut_ty, origins, ctx);
            }
        }
        _ => {}
    }
}

fn handle_call(call: &syn::ExprCall, mut cov: Covered, origins: &OriginMap, ctx: &Ctx) -> Covered {
    // Recognize `walk::walk_*(self, target)` patterns.
    let Expr::Path(p) = call.func.as_ref() else { return cov };
    let segs: Vec<String> = p.path.segments.iter().map(|s| s.ident.to_string()).collect();
    if segs.len() < 2 || segs[0] != "walk" || !segs[1].starts_with("walk_") {
        return cov;
    }
    if call.args.len() < 2 { return cov; }
    let target = &call.args[1];
    apply_origin_to_cov_typed(
        target,
        origins,
        ctx.it_name,
        ctx.it_node_type,
        Some(ctx.graph),
        &mut cov,
        true,
    );
    cov
}

fn handle_method_call(
    mc: &syn::ExprMethodCall,
    mut cov: Covered,
    origins: &OriginMap,
    ctx: &Ctx,
) -> Covered {
    // self.helper(args) — receiver must be `self`.
    let Expr::Path(p) = mc.receiver.as_ref() else { return cov };
    if !p.path.is_ident("self") { return cov; }
    let name = mc.method.to_string();
    let Some(info) = ctx.helpers.get(&name) else { return cov };
    // For each AST-typed arg the helper tracks, look up the positional call
    // arg by its `call_pos` and credit if the helper fully covers it.
    let call_args: Vec<&Expr> = mc.args.iter().collect();
    for ha in &info.args {
        if !ha.fully_covers { continue; }
        let Some(call_arg) = call_args.get(ha.call_pos) else { continue };
        apply_origin_to_cov_typed(
            call_arg,
            origins,
            ctx.it_name,
            ctx.it_node_type,
            Some(ctx.graph),
            &mut cov,
            true,
        );
    }
    cov
}

fn apply_origin_to_cov(
    e: &Expr,
    origins: &OriginMap,
    it_name: &str,
    cov: &mut Covered,
    all_if_root: bool,
) {
    apply_origin_to_cov_typed(e, origins, it_name, None, None, cov, all_if_root);
}

/// Type-aware variant. When the expression has Origin::It but its AST type
/// differs from the caller's `it_node_type`, we know we're walking a
/// *variant* of the caller's it (typical pattern: an `if let
/// EnumPath::Variant(v) = it` extracts a v of variant type — calling a
/// helper that fully covers v doesn't cover ALL variants of the outer it,
/// just the one we destructured).
fn apply_origin_to_cov_typed(
    e: &Expr,
    origins: &OriginMap,
    it_name: &str,
    it_node_type: Option<&str>,
    graph: Option<&AstGraph>,
    cov: &mut Covered,
    all_if_root: bool,
) {
    let o = resolve_origin(e, origins, it_name);
    match o {
        Origin::It => {
            if !all_if_root { return; }
            // Try to figure out the arg's type. If it's the same as the
            // outer `it`'s type, credit cov.all. If it's a R-variant of the
            // outer `it`'s enum type, credit that variant name.
            let arg_ty = graph.and_then(|g| {
                crate::helper_index::resolve_type(e, origins, it_name, it_node_type, g)
            });
            match (arg_ty.as_deref(), it_node_type) {
                (Some(at), Some(ot)) if at == ot => cov.all = true,
                (Some(at), Some(ot)) => {
                    // If `at` is listed as a variant of `ot` in our table,
                    // we covered just that variant.
                    let is_variant = graph
                        .and_then(|g| g.nodes.get(ot))
                        .map(|d| d.variants.iter().any(|v| *v == at))
                        .unwrap_or(false);
                    if is_variant {
                        cov.add_field(at);
                    } else {
                        // Mismatched type but not a known variant — be
                        // conservative and credit cov.all (preserves the
                        // earlier behavior).
                        cov.all = true;
                    }
                }
                _ => cov.all = true,
            }
        }
        Origin::Field(name) => cov.add_field(&name),
        Origin::Unknown => {}
    }
}

fn is_terminating_macro(mac: &syn::Macro) -> bool {
    let name = mac
        .path
        .segments
        .last()
        .map(|s| s.ident.to_string())
        .unwrap_or_default();
    matches!(name.as_str(), "panic" | "unreachable" | "todo" | "unimplemented")
}

fn handle_macro_invocation(mac: &syn::Macro, mut cov: Covered) -> Covered {
    let name = mac.path.segments.iter().last().map(|s| s.ident.to_string()).unwrap_or_default();
    match name.as_str() {
        "walk_all" => cov.all = true,
        "walk_field" | "walk_field_ctx" | "skip_field" => {
            if let Some(f) = extract_field_name(&mac.tokens) {
                cov.add_field(&f);
            }
        }
        "audit_skip" => {
            // Two forms:
            //   audit_skip!(it.<field>, "reason")  — credits a specific field
            //   audit_skip!("reason")              — credits the entire current
            //                                        scope (use inside the
            //                                        match arm / branch where
            //                                        the cull actually happens)
            if let Some(f) = extract_field_name(&mac.tokens) {
                cov.add_field(&f);
            } else {
                cov.all = true;
            }
        }
        _ => {}
    }
    cov
}

pub fn extract_field_name(ts: &TokenStream) -> Option<String> {
    use proc_macro2::TokenTree;
    let toks: Vec<TokenTree> = ts.clone().into_iter().collect();
    let mut last: Option<String> = None;
    let mut i = 0;
    while i + 2 < toks.len() {
        if let (TokenTree::Ident(a), TokenTree::Punct(p), TokenTree::Ident(c)) =
            (&toks[i], &toks[i + 1], &toks[i + 2])
        {
            if a == "it" && p.as_char() == '.' {
                last = Some(c.to_string());
                i += 3;
                continue;
            }
        }
        i += 1;
    }
    last
}

pub fn extract_receiver_and_field(ts: &TokenStream) -> Option<(syn::Ident, String)> {
    use proc_macro2::TokenTree;
    let toks: Vec<TokenTree> = ts.clone().into_iter().collect();
    let mut found = None;
    let mut i = 0;
    while i + 2 < toks.len() {
        if let (TokenTree::Ident(a), TokenTree::Punct(p), TokenTree::Ident(c)) =
            (&toks[i], &toks[i + 1], &toks[i + 2])
        {
            if p.as_char() == '.' {
                found = Some((a.clone(), c.to_string()));
            }
        }
        i += 1;
    }
    found
}
