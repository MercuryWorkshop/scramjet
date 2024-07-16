set RUSTFLAGS="-C target-feature=+atomics,+bulk-memory,+simd128"
cargo build --lib --target wasm32-unknown-unknown -Z build-std=panic_abort,std --release
wasm-bindgen --weak-refs --target web --out-dir out/ target/wasm32-unknown-unknown/release/rewriter.wasm

cd ..

$WASM = "rewriter/out/rewriter_bg.wasm"

Measure-Command -Expression { wasm-opt -Oz --vacuum --dce --enable-threads --enable-bulk-memory --enable-simd "$WASM" -o rewriter/out/optimized.wasm }

Write-Output -n "self.WASM = '" > static/wasm.js
[System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes("rewriter/out/optimized.wasm")) >> static/wasm.js
Write-Output -n "';" >> static/wasm.js
Write-Output "Rewriter Build Complete!"