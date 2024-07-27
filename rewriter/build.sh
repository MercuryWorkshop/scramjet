RUSTFLAGS='-C target-feature=+atomics,+bulk-memory -Zlocation-detail=none' cargo build --lib --target wasm32-unknown-unknown -Z build-std=panic_abort,std -Z build-std-features=panic_immediate_abort --release
wasm-bindgen --weak-refs --target web --out-dir out/ target/wasm32-unknown-unknown/release/rewriter.wasm

sed -i 's/import.meta.url/""/g' out/rewriter.js

cd ..

WASM=rewriter/out/rewriter_bg.wasm

time wasm-opt -O4 --vacuum --dce --enable-threads --enable-bulk-memory --enable-simd "$WASM" -o rewriter/out/optimized.wasm
# cp "$WASM" rewriter/out/optimized.wasm

echo -n "self.WASM = '" > static/wasm.js
base64 -w0 < "rewriter/out/optimized.wasm" >> static/wasm.js
echo -n "';">> static/wasm.js
echo "Rewriter Build Complete!"
