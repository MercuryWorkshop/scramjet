//! Build a global index of every method in visitor.rs that takes a `&AstNode`
//! as its first non-self argument. For each, recursively analyze the body to
//! determine whether it fully covers all R-reaching fields of that node.
//!
//! Helpers (`recurse_*`, `handle_*`) get the same treatment as visit_* methods
//! — if their body provably walks every R-field of their input, they're
//! recorded as "fully covers". Callers can then credit the corresponding
//! field at the call site.

use std::collections::HashMap;

use syn::{Expr, FnArg, ImplItem, Item, Pat, PatType, Type};

use crate::reachability::AstGraph;

/// Per-AST-typed-argument coverage data.
#[derive(Clone, Debug)]
pub struct HelperArg {
    pub name: String,
    pub ast_type: String,
    /// 0-based index of this arg in the original `fn helper(&mut self, a,
    /// b, c, ...)` signature (excluding `self`). Needed at call sites to
    /// pair the helper's per-arg coverage with the right positional call
    /// argument (since non-AST args are filtered out of `args` but appear in
    /// the call expression's positional list).
    pub call_pos: usize,
    pub fully_covers: bool,
    pub covered_set: std::collections::BTreeSet<String>,
    pub covered_all: bool,
}

#[derive(Clone, Debug)]
pub struct HelperInfo {
    pub name: String,
    pub args: Vec<HelperArg>,

    // Backward-compat: views over args[0]. These shadow the per-arg fields so
    // existing call sites that read `info.node_type` / `info.fully_covers` /
    // `info.covered_set` / `info.covered_all` keep working.
    pub node_type: String,
    pub it_param_name: String,
    pub fully_covers: bool,
    pub covered_set: std::collections::BTreeSet<String>,
    pub covered_all: bool,
}

impl HelperInfo {
    pub fn refresh_first_arg_view(&mut self) {
        if let Some(a) = self.args.first() {
            self.node_type = a.ast_type.clone();
            self.it_param_name = a.name.clone();
            self.fully_covers = a.fully_covers;
            self.covered_set = a.covered_set.clone();
            self.covered_all = a.covered_all;
        }
    }
}

/// Working copy used only during build_index (carries the body for analysis).
#[derive(Clone, Debug)]
struct WorkingHelper {
    info: HelperInfo,
    body: syn::Block,
}

#[derive(Default, Debug, Clone)]
pub struct HelperIndex {
    by_name: HashMap<String, HelperInfo>,
}

impl HelperIndex {
    pub fn lookup(&self, name: &str) -> Option<&HelperInfo> {
        self.by_name.get(name)
    }
    pub fn all(&self) -> impl Iterator<Item = &HelperInfo> {
        self.by_name.values()
    }
}

/// Lazily parse visitor.rs and build the index. The result contains only
/// owned `String` values and no proc_macro2 tokens — safe to cache across
/// macro invocations.
///
/// We cache the file's content hash + the resulting HelperIndex so we don't
/// re-parse on every proc-macro invocation. (Tokens would be use-after-free
/// across invocations, but Strings/bools are fine.)
pub fn index() -> HelperIndex {
    use std::sync::Mutex;
    static CACHE: Mutex<Option<(u64, HelperIndex)>> = Mutex::new(None);

    let Some(path) = locate_visitor_rs() else {
        return HelperIndex::default();
    };
    let Ok(src) = std::fs::read_to_string(&path) else {
        return HelperIndex::default();
    };
    // Cheap content hash.
    let mut hash: u64 = 1469598103934665603;
    for b in src.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    {
        let g = CACHE.lock().unwrap();
        if let Some((h, idx)) = g.as_ref() {
            if *h == hash {
                return idx.clone();
            }
        }
    }
    let idx = build_index_from(&src);
    let mut g = CACHE.lock().unwrap();
    *g = Some((hash, idx.clone()));
    idx
}

fn build_index_from(src: &str) -> HelperIndex {
    let Ok(file) = syn::parse_file(src) else {
        return HelperIndex::default();
    };

    let mut working: HashMap<String, WorkingHelper> = HashMap::new();

    for item in &file.items {
        if let Item::Impl(imp) = item {
            for ii in &imp.items {
                if let ImplItem::Fn(f) = ii {
                    if let Some(w) = extract_method(f) {
                        working.insert(w.info.name.clone(), w);
                    }
                }
            }
        }
    }

    // Fixpoint: re-check each helper's full-coverage until stable.
    let graph = AstGraph::build();
    loop {
        let mut changed = false;
        let names: Vec<String> = working.keys().cloned().collect();
        // Snapshot infos for analyze_helper input.
        let infos_snapshot: HashMap<String, HelperInfo> = working
            .iter()
            .map(|(k, v)| (k.clone(), v.info.clone()))
            .collect();
        for name in names {
            let w = working.get(&name).unwrap().clone();
            // Re-analyze each AST-typed arg independently.
            let mut new_args = w.info.args.clone();
            let mut any_changed = false;
            for arg_idx in 0..new_args.len() {
                let (fully, set, all) =
                    analyze_helper_arg(&w, arg_idx, &infos_snapshot, &graph);
                let a = &mut new_args[arg_idx];
                if fully != a.fully_covers || all != a.covered_all || set != a.covered_set {
                    a.fully_covers = fully;
                    a.covered_set = set;
                    a.covered_all = all;
                    any_changed = true;
                }
            }
            if any_changed {
                let info = &mut working.get_mut(&name).unwrap().info;
                info.args = new_args;
                info.refresh_first_arg_view();
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }

    HelperIndex {
        by_name: working.into_iter().map(|(k, v)| (k, v.info)).collect(),
    }
}

fn locate_visitor_rs() -> Option<String> {
    if let Ok(p) = std::env::var("COVERAGE_VISITOR_FILE") {
        return Some(p);
    }
    // Default: relative to coverage-macro's CARGO_MANIFEST_DIR.
    let dir = env!("CARGO_MANIFEST_DIR");
    Some(format!("{dir}/../js/src/visitor.rs"))
}

fn extract_method(f: &syn::ImplItemFn) -> Option<WorkingHelper> {
    let name = f.sig.ident.to_string();
    let mut iter = f.sig.inputs.iter();
    let _recv = iter.next()?;
    // Collect every &T arg whose T resolves to a known AST type.
    let mut args: Vec<HelperArg> = Vec::new();
    let graph = AstGraph::build();
    for (pos, arg) in iter.enumerate() {
        let FnArg::Typed(PatType { pat, ty, .. }) = arg else { continue };
        let pname = match pat.as_ref() {
            Pat::Ident(p) => p.ident.to_string(),
            _ => continue,
        };
        let Some(ast_type) = extract_ref_type_name(ty) else { continue };
        // Only accept types we know are AST nodes (in our shape table).
        if !graph.nodes.contains_key(ast_type.as_str()) {
            continue;
        }
        args.push(HelperArg {
            name: pname,
            ast_type,
            call_pos: pos,
            fully_covers: false,
            covered_set: std::collections::BTreeSet::new(),
            covered_all: false,
        });
    }
    if args.is_empty() { return None; }
    let mut info = HelperInfo {
        name,
        args,
        node_type: String::new(),
        it_param_name: String::new(),
        fully_covers: false,
        covered_set: std::collections::BTreeSet::new(),
        covered_all: false,
    };
    info.refresh_first_arg_view();
    Some(WorkingHelper { info, body: f.block.clone() })
}

/// Given a `&Foo<'a>` or `&Foo` type, return `"Foo"`. Handles fully-qualified
/// paths like `oxc::ast::ast::Foo` by taking the last segment.
fn extract_ref_type_name(ty: &Type) -> Option<String> {
    let Type::Reference(r) = ty else { return None };
    let Type::Path(tp) = r.elem.as_ref() else {
        return None;
    };
    let last = tp.path.segments.last()?;
    Some(last.ident.to_string())
}

/// Returns (fully_covers, covered_set, covered_all) for the helper's
/// first AST arg. (Kept for the snippet-builder/fixpoint convenience.)
#[allow(dead_code)]
fn analyze_helper(
    w: &WorkingHelper,
    helpers: &HashMap<String, HelperInfo>,
    graph: &AstGraph,
) -> (bool, std::collections::BTreeSet<String>, bool) {
    analyze_helper_arg(w, 0, helpers, graph)
}

/// Analyzes the helper's body treating arg #`arg_idx` as the "it" being
/// covered. Returns its (fully_covers, covered_set, covered_all).
fn analyze_helper_arg(
    w: &WorkingHelper,
    arg_idx: usize,
    helpers: &HashMap<String, HelperInfo>,
    graph: &AstGraph,
) -> (bool, std::collections::BTreeSet<String>, bool) {
    let Some(arg) = w.info.args.get(arg_idx) else {
        return (false, std::collections::BTreeSet::new(), false);
    };
    let Some(def) = graph.nodes.get(arg.ast_type.as_str()) else {
        return (false, std::collections::BTreeSet::new(), false);
    };

    let mut origins = OriginMap::new();
    // Treat the analyzed arg as `it` for this pass. Other AST args get a
    // best-effort Origin::Unknown so walks on them don't credit the wrong
    // field.
    origins.set_binding(&arg.name, Binding::it(Some(arg.ast_type.clone())));
    for (i, other) in w.info.args.iter().enumerate() {
        if i == arg_idx { continue; }
        origins.set_binding(
            &other.name,
            Binding {
                origin: Origin::Unknown,
                ast_type: Some(other.ast_type.clone()),
            },
        );
    }

    // Optimistic self-coverage on every arg so recursive helpers don't
    // pessimize themselves.
    let mut optimistic_helpers = helpers.clone();
    if let Some(self_info) = optimistic_helpers.get_mut(&w.info.name) {
        for a in &mut self_info.args {
            a.fully_covers = true;
        }
        self_info.refresh_first_arg_view();
    }

    let paths = crate::analyze::analyze_with_helpers_typed(
        &w.body,
        &arg.name,
        Some(&arg.ast_type),
        &optimistic_helpers,
        graph,
        origins,
    );

    // Compute intersection of covered across all paths (the conservative
    // "always covered" set).
    let mut combined: Option<crate::analyze::Covered> = None;
    for p in &paths {
        combined = Some(match combined {
            None => p.covered.clone(),
            Some(prev) => crate::analyze::Covered::intersect(&prev, &p.covered),
        });
    }
    let combined = combined.unwrap_or(crate::analyze::Covered::empty());

    // Verify fully_covers across all paths.
    let mut fully = true;
    for p in &paths {
        let covered_all = p.covered.all;
        for f in def.fields {
            if !graph.field_in_r(f) {
                continue;
            }
            if !covered_all && !p.covered.fields.iter().any(|n| n == f.name) {
                fully = false;
                break;
            }
        }
        // For enum node_types (no fields, only variants), fully_covers
        // requires covered_all (the helper must walk the whole enum).
        if def.fields.is_empty() && !def.variants.is_empty() && !covered_all {
            fully = false;
        }
        if !fully { break; }
    }

    (fully, combined.fields, combined.all)
}

/// A local binding's tracked information: where in the AST it comes from
/// (relative to `it`) and what AST type it holds.
#[derive(Clone, Debug)]
pub struct Binding {
    pub origin: Origin,
    /// AST node type (e.g. "AssignmentTarget", "BindingPattern"). None when
    /// the type couldn't be inferred from the binding site.
    pub ast_type: Option<String>,
}

impl Binding {
    pub fn unknown() -> Self {
        Self { origin: Origin::Unknown, ast_type: None }
    }
    pub fn it(ty: Option<String>) -> Self {
        Self { origin: Origin::It, ast_type: ty }
    }
    pub fn with_origin(origin: Origin) -> Self {
        Self { origin, ast_type: None }
    }
}

/// Tracks per-local origin AND ast type within a method body.
#[derive(Clone, Debug, Default)]
pub struct OriginMap {
    map: HashMap<String, Binding>,
}

impl OriginMap {
    pub fn new() -> Self {
        Self::default()
    }
    /// Backward-compat: set just the origin, leave type unknown.
    pub fn set(&mut self, name: &str, origin: Origin) {
        self.map.insert(name.to_string(), Binding::with_origin(origin));
    }
    pub fn set_binding(&mut self, name: &str, b: Binding) {
        self.map.insert(name.to_string(), b);
    }
    pub fn get(&self, name: &str) -> Origin {
        self.map
            .get(name)
            .map(|b| b.origin.clone())
            .unwrap_or(Origin::Unknown)
    }
    pub fn get_binding(&self, name: &str) -> Binding {
        self.map.get(name).cloned().unwrap_or_else(Binding::unknown)
    }
    pub fn get_type(&self, name: &str) -> Option<String> {
        self.map.get(name).and_then(|b| b.ast_type.clone())
    }
}

#[derive(Clone, Debug)]
pub enum Origin {
    /// Refers to the `it` arg itself.
    It,
    /// A field of `it`. Sub-accesses (`.bar`, `[i]`) on a Field still carry
    /// the parent field name — we only care which top-level R-field of `it`
    /// is being touched.
    Field(String),
    Unknown,
}

/// Resolve the origin of an expression: trace `&x`, `x.y`, `it.foo`, etc.
pub fn resolve_origin(e: &Expr, origins: &OriginMap, it_name: &str) -> Origin {
    let inner = match e {
        Expr::Reference(r) => r.expr.as_ref(),
        other => other,
    };
    match inner {
        Expr::Path(p) => {
            if p.path.is_ident(it_name) {
                return Origin::It;
            }
            if let Some(seg) = p.path.get_ident() {
                return origins.get(&seg.to_string());
            }
            Origin::Unknown
        }
        Expr::Field(f) => {
            // Could be `it.foo`, `it.foo.bar`, or `local.field`.
            // Trace the base.
            let base = resolve_origin(&f.base, origins, it_name);
            match base {
                Origin::It => {
                    if let syn::Member::Named(n) = &f.member {
                        return Origin::Field(n.to_string());
                    }
                    Origin::Unknown
                }
                other => other,
            }
        }
        Expr::Index(idx) => resolve_origin(&idx.expr, origins, it_name),
        Expr::MethodCall(m) => {
            // e.g. `.unwrap()`, `.as_assignment_target()`. Pass through.
            resolve_origin(&m.receiver, origins, it_name)
        }
        _ => Origin::Unknown,
    }
}

/// Resolve the AST type of an expression.
///
/// - `it` → `it_type`.
/// - `it.foo` → look up `foo` in `it_type`'s fields → field's type.
/// - `local` → from the OriginMap.
/// - `local.foo` → look up `foo` in `local`'s type.
/// - method calls → small hardcoded table for known oxc conversions
///   (`as_assignment_target`, `unwrap`, etc.).
/// - references / indexing → pass through.
pub fn resolve_type(
    e: &Expr,
    origins: &OriginMap,
    it_name: &str,
    it_type: Option<&str>,
    graph: &crate::reachability::AstGraph,
) -> Option<String> {
    let inner = match e {
        Expr::Reference(r) => r.expr.as_ref(),
        other => other,
    };
    match inner {
        Expr::Path(p) => {
            if p.path.is_ident(it_name) {
                return it_type.map(String::from);
            }
            if let Some(seg) = p.path.get_ident() {
                return origins.get_type(&seg.to_string());
            }
            None
        }
        Expr::Field(f) => {
            let base_ty = resolve_type(&f.base, origins, it_name, it_type, graph)?;
            if let syn::Member::Named(n) = &f.member {
                let def = graph.nodes.get(base_ty.as_str())?;
                let field = def.fields.iter().find(|fd| fd.name == n.to_string())?;
                return Some(field.ty.to_string());
            }
            None
        }
        Expr::Index(i) => resolve_type(&i.expr, origins, it_name, it_type, graph),
        Expr::MethodCall(m) => {
            let recv_ty = resolve_type(&m.receiver, origins, it_name, it_type, graph);
            let method = m.method.to_string();
            method_result_type(recv_ty.as_deref(), &method)
        }
        _ => None,
    }
}

/// Hardcoded table for method-call result types. Conservative — returns None
/// for unknown methods so the type tracker degrades to "I don't know" rather
/// than asserting a wrong type.
fn method_result_type(recv: Option<&str>, method: &str) -> Option<String> {
    // Pass-through methods on Option/Result/Box/&T — the inner value type is
    // the same as the receiver's logical type for our purposes.
    let pass_through = [
        "unwrap", "unwrap_or", "unwrap_or_else", "expect", "as_ref", "as_deref",
        "as_mut", "as_deref_mut", "clone", "to_owned",
    ];
    if pass_through.contains(&method) {
        return recv.map(String::from);
    }
    // oxc-specific conversions.
    let recv = recv?;
    match (recv, method) {
        ("ForStatementLeft", "as_assignment_target") => Some("AssignmentTarget".into()),
        ("AssignmentTargetMaybeDefault", "as_assignment_target") => {
            Some("AssignmentTarget".into())
        }
        ("AssignmentTarget", "to_simple_assignment_target") => {
            Some("SimpleAssignmentTarget".into())
        }
        ("MemberExpression", "to_member_expression") => Some("MemberExpression".into()),
        ("BindingPattern", "get_identifier_name") => None,
        _ => None,
    }
}

/// For loops: `for v in &it.foo` → v's origin = Field("foo").
/// `resolve_origin` already does the right thing by returning the top-level
/// `Field(name)` regardless of how deeply we project, so we just delegate.
pub fn origin_from_iter(iter: &Expr, origins: &OriginMap, it_name: &str) -> Origin {
    resolve_origin(iter, origins, it_name)
}

/// For loops: element type of the iterator. `for v in &it.foo.items` where
/// `items` is `Vec<X>` → v's type = X. We assume the iterator is a reference
/// to a Vec/slice/Option whose element is itself an AST type.
pub fn iter_element_type(
    iter: &Expr,
    origins: &OriginMap,
    it_name: &str,
    it_type: Option<&str>,
    graph: &crate::reachability::AstGraph,
) -> Option<String> {
    // The iter expression's type IS the collection field type (e.g.
    // BindingProperty for ObjectPattern.properties: Vec<BindingProperty>).
    // resolve_type peels references and field accesses to give us the inner
    // type. For Vec/Option fields we registered the *element* type in
    // ast_table.rs (Cardinality flags carry that). resolve_type already
    // returns the element type because our table stores `ty` as the element.
    resolve_type(iter, origins, it_name, it_type, graph)
}

#[allow(dead_code)]
pub fn dump_helpers(idx: &HelperIndex) -> String {
    let mut names: Vec<_> = idx.by_name.keys().cloned().collect();
    names.sort();
    let mut s = String::new();
    for n in names {
        let h = &idx.by_name[&n];
        s.push_str(&format!(
            "  {} : &{} -> fully_covers={}\n",
            h.name, h.node_type, h.fully_covers
        ));
    }
    s
}
