#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit

RUSTFLAGS='-C target-feature=+atomics,+bulk-memory -Zlocation-detail=none' cargo build --lib --target wasm32-unknown-unknown -Z build-std=panic_abort,std -Z build-std-features=panic_immediate_abort --features "${FEATURES:-}" --release
wasm-bindgen --weak-refs --target web --out-dir out/ target/wasm32-unknown-unknown/release/rewriter.wasm

sed -i 's/import.meta.url/""/g' out/rewriter.js

cd ..

WASM=rewriter/out/rewriter_bg.wasm

if ! [ "${RELEASE:-0}" = "1" ]; then
	WASMOPTFLAGS="-g"
else
	WASMOPTFLAGS=""
fi

time wasm-opt $WASMOPTFLAGS -O4 --vacuum --dce --enable-threads --enable-bulk-memory --enable-simd "$WASM" -o rewriter/out/optimized.wasm

echo -n "self.WASM = '" > dist/scramjet.wasm.js
base64 -w0 < "rewriter/out/optimized.wasm" >> dist/scramjet.wasm.js
echo -n "';">> dist/scramjet.wasm.js
echo "Rewriter Build Complete!"
