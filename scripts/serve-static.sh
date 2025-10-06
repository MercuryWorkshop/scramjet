#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

pnpm install

if [ ! -d "rewriter/target" ]; then
    pnpm run rewriter:build
fi
if [ ! -d "dist" ]; then
    pnpm run build
fi

bash ci/download-existing-docs.sh
bash ci/build-docs.sh
bash ci/build-static.sh

if [ -f "staticbuild/typedoc/index.html" ]; then
    sed -i '' 's|url=dev/|url=/typedoc/dev/|g' staticbuild/typedoc/index.html
fi
if [ -f "staticbuild/typedoc-dev/index.html" ]; then
    sed -i '' 's|url=dev/|url=/typedoc-dev/dev/|g' staticbuild/typedoc-dev/index.html
fi

cd staticbuild
echo "Demo server starting at http://localhost:3000"
echo "TypeDoc available at http://localhost:3000/typedoc"
npx serve -l 3000 &
SERVER_PID=$!

wait $SERVER_PID