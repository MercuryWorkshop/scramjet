#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit

# Check for cargo and wasm-bindgen
which cargo wasm-bindgen wasm-opt &> /dev/null || {
	echo "Please install cargo, wasm-bindgen, and wasm-opt! Exiting..."
	exit 1
}

WBG="wasm-bindgen 0.2.99"
if ! [[ "$(wasm-bindgen -V)" =~ ^"$WBG" ]]; then
	echo "Incorrect wasm-bindgen-cli version: '$(wasm-bindgen -V)' != '$WBG'"
	exit 1
fi

if ! [ "${RELEASE:-0}" = "1" ]; then
	: "${WASMOPTFLAGS:=-g}"
	: "${FEATURES:=debug}"
else
	: "${WASMOPTFLAGS:=}"
	: "${FEATURES:=}"
fi

RUSTFLAGS='-C target-feature=+atomics,+bulk-memory,+simd128 -Zlocation-detail=none -Zfmt-debug=none' cargo build --lib --target wasm32-unknown-unknown -Z build-std=panic_abort,std -Z build-std-features=panic_immediate_abort --no-default-features --features "$FEATURES" --release
wasm-bindgen --target web --out-dir out/ ../target/wasm32-unknown-unknown/release/wasm.wasm

sed -i 's/import.meta.url/""/g' out/wasm.js

cd ../../

wasm-snip rewriter/wasm/out/wasm_bg.wasm -o rewriter/wasm/out/wasm_snipped.wasm -p 'oxc_regular_expression::.*' -p 'oxc_parser::ts::.*'

# shellcheck disable=SC2086
time wasm-opt $WASMOPTFLAGS --converge -tnh -O4 --vacuum --dce --enable-threads --enable-bulk-memory --enable-simd rewriter/wasm/out/wasm_snipped.wasm -o rewriter/wasm/out/optimized.wasm

mkdir -p dist/

cp rewriter/wasm/out/optimized.wasm dist/scramjet.wasm.wasm
{

cat <<EOF
if ("document" in self && document?.currentScript) {
	document.currentScript.remove();
}
EOF
echo -n "self.WASM = '"
base64 -w0 < "rewriter/wasm/out/optimized.wasm"
echo -n "';"

} > dist/scramjet.wasm.js
echo "Rewriter Build Complete!"
