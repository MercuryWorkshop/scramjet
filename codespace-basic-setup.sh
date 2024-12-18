curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env" # to import rustup in current shell
pnpm i
cargo install wasm-bindgen-cli
VER=$(curl --silent -qI https://github.com/WebAssembly/binaryen/releases/latest | awk -F '/' '/^location/ {print  substr($NF, 1, length($NF)-1)}'); \
curl -LO https://github.com/WebAssembly/binaryen/releases/download/$VER/binaryen-${VER}-x86_64-linux.tar.gz
tar xvf binaryen-${VER}-x86_64-linux.tar.gz
rm -rf binaryen-${VER}-x86_64-linux.tar.gz
mv binaryen-${VER}/bin/* ~/.local/bin
mv binaryen-${VER}/lib/* ~/.local/lib
rm -rf binaryen-${VER}
cargo install --git https://github.com/r58playz/wasm-snip
pnpm rewriter:build
pnpm build