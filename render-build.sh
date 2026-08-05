#!/usr/bin/env bash
# Build script for deploying the Scramjet demo on Render (or any Node host).
#
# Scramjet's URL rewriter is compiled from Rust to WebAssembly, so the build
# needs a Rust toolchain plus wasm-bindgen, wasm-opt (binaryen) and a
# wasm-snip fork. This installs all of them into the build sandbox using
# prebuilt binaries where possible to keep the build reasonably fast.
#
# The heavy RELEASE wasm-opt pass is intentionally skipped (we don't export
# RELEASE=1): it can add 10+ minutes and only shrinks the wasm. The debug
# wasm is larger but functionally identical, which is fine for a free demo.
set -euo pipefail

WBG_VER="0.2.105"
BINARYEN_VER="version_123"
LOCAL_BIN="$HOME/.local/bin"
mkdir -p "$LOCAL_BIN"
export PATH="$LOCAL_BIN:$HOME/.cargo/bin:$PATH"

echo "==> Installing Rust toolchain"
if ! command -v rustup >/dev/null 2>&1; then
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
		| sh -s -- -y --profile minimal --default-toolchain nightly
fi
# Render's build image ships rustup but with no default toolchain configured,
# which breaks plain `cargo`/`cargo install`. Pin nightly as the default and
# make sure the wasm target + rust-src (needed by build-std) are installed.
# The rewriter build itself uses `cargo +nightly`, and its rust-toolchain.toml
# pins nightly too, so this stays consistent.
rustup default nightly
rustup target add wasm32-unknown-unknown
rustup component add rust-src

echo "==> Installing wasm-bindgen ${WBG_VER}"
if ! wasm-bindgen -V 2>/dev/null | grep -q "$WBG_VER"; then
	curl -sSL "https://github.com/rustwasm/wasm-bindgen/releases/download/${WBG_VER}/wasm-bindgen-${WBG_VER}-x86_64-unknown-linux-musl.tar.gz" -o /tmp/wbg.tar.gz
	tar -xzf /tmp/wbg.tar.gz -C /tmp
	cp "/tmp/wasm-bindgen-${WBG_VER}-x86_64-unknown-linux-musl/wasm-bindgen" "$LOCAL_BIN/"
fi

echo "==> Installing wasm-opt (binaryen ${BINARYEN_VER})"
if ! command -v wasm-opt >/dev/null 2>&1; then
	curl -sSL "https://github.com/WebAssembly/binaryen/releases/download/${BINARYEN_VER}/binaryen-${BINARYEN_VER}-x86_64-linux.tar.gz" -o /tmp/binaryen.tar.gz
	tar -xzf /tmp/binaryen.tar.gz -C /tmp
	cp "/tmp/binaryen-${BINARYEN_VER}/bin/wasm-opt" "$LOCAL_BIN/"
fi

echo "==> Installing wasm-snip fork"
if ! command -v wasm-snip >/dev/null 2>&1; then
	cargo install --git https://github.com/r58Playz/wasm-snip wasm-snip
fi

echo "==> Installing node dependencies"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

echo "==> Building the Rust -> WASM rewriter"
pnpm --dir packages/core rewriter:build

echo "==> Building scramjet core, controller and utils bundles"
pnpm exec rspack build --mode production

echo "==> Building the static demo"
# Leave VITE_WISP_URL unset so the client derives the Wisp endpoint from the
# SAME ORIGIN that serves the page. This means the same build works on the
# onrender host, a custom domain, or localhost with no rebuild — and a custom
# domain fully bypasses a block on the original host, because the WebSocket
# targets the page's own domain rather than a hardcoded backend.
# Set VITE_WISP_URL only if the Wisp backend lives on a different origin.
if [ -n "${VITE_WISP_URL:-}" ]; then echo "    VITE_WISP_URL=${VITE_WISP_URL}"; fi
pnpm --filter @mercuryworkshop/scramjet-demo build

echo "==> Build complete. Static output: packages/demo/dist"
