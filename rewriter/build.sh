#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit

# Check for cargo and wasm-bindgen
which cargo wasm-bindgen wasm-opt &> /dev/null || {
	echo "Please install cargo, wasm-bindgen, and wasm-opt! Exiting..."
	exit 1
}

WBG="wasm-bindgen 0.2.95"
if [ "$(wasm-bindgen -V)" != "$WBG" ]; then
	echo "Incorrect wasm-bindgen version: '$(wasm-bindgen -V)' != '$WBG'"
	exit 1
fi

RUSTFLAGS='-C target-feature=+atomics,+bulk-memory,+simd128 -Zlocation-detail=none' cargo build --lib --target wasm32-unknown-unknown -Z build-std=panic_abort,std -Z build-std-features=panic_immediate_abort --features "${FEATURES:-}" --release
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

{

cat <<EOF
if ("document" in self && document.currentScript) {
	document.currentScript.remove();
}
EOF
echo -n "self.WASM = '"
base64 -w0 < "rewriter/out/optimized.wasm"
echo -n "';"

} > dist/scramjet.wasm.js
echo "Rewriter Build Complete!"
