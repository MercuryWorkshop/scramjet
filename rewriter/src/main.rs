#![allow(clippy::print_stdout)]
use std::{env, path::Path, str::FromStr};

use oxc_allocator::Allocator;
use oxc_ast::{
    ast::{AssignmentTarget, Class, Function, IdentifierReference, MemberExpression, TSImportType},
    visit::walk,
    Visit,
};
use oxc_parser::Parser;
use oxc_span::{SourceType, Span};
use oxc_syntax::scope::ScopeFlags;

pub mod rewrite;

use rewrite::rewrite;
use url::Url;

// Instruction:
// create a `test.js`,
// run `cargo run -p oxc_parser --example visitor`
// or `cargo watch -x "run -p oxc_parser --example visitor"`

fn main() -> std::io::Result<()> {
    let name = env::args().nth(1).unwrap_or_else(|| "test.js".to_string());
    let path = Path::new(&name);
    let source_text = std::fs::read_to_string(path)?;

    println!(
        "{}",
        rewrite(
            &source_text,
            Url::from_str("https://google.com/glorngle/si.js").unwrap()
        )
    );

    Ok(())
}
