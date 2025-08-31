#!/bin/bash
cp -r existing-typedoc/* _docs/ || true
cp -r existing-typedoc-dev/* _docs-dev/ || true

pnpm run docs || true
pnpm run docs:dev || true

VERSION=$(jq -r '.version' package.json)

if [ -f "_docs/.typedoc-plugin-versions" ]; then
    existing_versions=$(jq -r '.versions[]?' existing-typedoc/.typedoc-plugin-versions || echo "")
    if [ -n "$existing_versions" ]; then
        all_versions=$(printf '%s\n' $existing_versions "v$VERSION" | sort -u)
        printf '%s\n' $all_versions | jq -R . | jq -s --arg dev "v$VERSION" '{"versions": ., "dev": $dev}' > _docs/.typedoc-plugin-versions
    else
        jq -n --arg version "v$VERSION" '{"versions":[$version],"dev":$version}' > _docs/.typedoc-plugin-versions
    fi
fi

if [ -f "_docs-dev/.typedoc-plugin-versions" ]; then
    existing_versions_dev=$(jq -r '.versions[]?' existing-typedoc-dev/.typedoc-plugin-versions || echo "")
    if [ -n "$existing_versions_dev" ]; then
        all_versions_dev=$(printf '%s\n' $existing_versions_dev "v$VERSION" | sort -u)
        printf '%s\n' $all_versions_dev | jq -R . | jq -s --arg dev "v$VERSION" '{"versions": ., "dev": $dev}' > _docs-dev/.typedoc-plugin-versions
    else
        jq -n --arg version "v$VERSION" '{"versions":[$version],"dev":$version}' > _docs-dev/.typedoc-plugin-versions
    fi
fi

tar -czf "typedoc-$VERSION.tar.gz" -C _docs .
tar -czf "typedoc-$VERSION.tar.gz-dev" -C _docs-dev .
