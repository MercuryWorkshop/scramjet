//! Compute the set R of node types whose subtree can reach an Expression.
//!
//! `R` is the transitive closure of the field/variant edges in the AST graph
//! starting from `Expression`. A node type is in R iff:
//! - it IS `Expression` (or one of its variants — they're all R since they
//!   either ARE expressions or are reachable from one)
//! - any of its fields has a type in R
//! - any of its variants is in R
//!
//! We treat `IdentifierReference` as the canonical "rewriteable leaf" inside R.
//! The bug class we want to kill is: an AST node containing an
//! `IdentifierReference` somewhere in its subtree gets skipped by the visitor.

use std::collections::{HashMap, HashSet};

use crate::ast_table::{Cardinality, Field, NODES, NodeDef};

#[derive(Clone, Debug)]
pub struct AstGraph {
    pub nodes: HashMap<&'static str, &'static NodeDef>,
    /// Set of node types that can transitively reach `Expression`.
    pub reaches_expression: HashSet<&'static str>,
}

impl AstGraph {
    pub fn build() -> Self {
        let mut nodes = HashMap::new();
        for n in NODES {
            nodes.insert(n.name, n);
        }

        // Compute reachability via fixpoint. Seed with `Expression` and its
        // variants and `IdentifierReference`.
        let mut r: HashSet<&'static str> = HashSet::new();
        r.insert("Expression");
        r.insert("IdentifierReference");

        loop {
            let mut changed = false;
            for n in NODES {
                if r.contains(n.name) {
                    continue;
                }
                let mut hit = false;
                for v in n.variants {
                    if r.contains(v) {
                        hit = true;
                        break;
                    }
                }
                if !hit {
                    for f in n.fields {
                        if r.contains(f.ty) {
                            hit = true;
                            break;
                        }
                    }
                }
                if hit {
                    r.insert(n.name);
                    changed = true;
                }
            }
            if !changed {
                break;
            }
        }

        Self {
            nodes,
            reaches_expression: r,
        }
    }

    pub fn in_r(&self, ty: &str) -> bool {
        self.reaches_expression.contains(ty)
    }

    pub fn field_in_r(&self, f: &Field) -> bool {
        // Cardinality doesn't matter for R-membership — Option<T> and Vec<T>
        // are in R iff T is.
        let _ = Cardinality::One;
        self.in_r(f.ty)
    }
}
