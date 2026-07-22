FROM node:lts AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    binaryen \
    build-essential \
    ca-certificates \
    curl \
    git \
 && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN corepack enable

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal \
 && rustup toolchain install nightly \
 && rustup component add rust-src --toolchain nightly \
 && rustup target add wasm32-unknown-unknown --toolchain nightly \
 && cargo install wasm-bindgen-cli --version 0.2.105 \
 && cargo install --git https://github.com/r58playz/wasm-snip

COPY . .

RUN CI=1 pnpm install --frozen-lockfile
RUN cd packages/core && pnpm rewriter:build && pnpm build
RUN cd packages/controller && pnpm build
RUN cd packages/utils && pnpm build
RUN cd packages/demo && pnpm build
RUN cd packages/bootstrap && pnpm pack
RUN cp /app/packages/bootstrap/mercuryworkshop-proxy-bootstrap-*.tgz /tmp/proxy-bootstrap.tgz

FROM node:lts-slim

WORKDIR /app

COPY --from=builder /app/packages/create-proxy-app/templates/default/package.json ./
COPY --from=builder /app/packages/create-proxy-app/templates/default/server.js ./
COPY --from=builder /app/packages/demo/dist ./public
COPY --from=builder /tmp/proxy-bootstrap.tgz /tmp/proxy-bootstrap.tgz

RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.dependencies['@mercuryworkshop/proxy-bootstrap']='file:/tmp/proxy-bootstrap.tgz';fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');" \
 && npm install --omit=dev --ignore-scripts \
 && rm -f /tmp/proxy-bootstrap.tgz

EXPOSE 3030

CMD ["node", "server.js"]
