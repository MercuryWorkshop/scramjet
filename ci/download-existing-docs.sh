#!/bin/bash
mkdir -p existing-typedoc existing-typedoc-dev

declare -A versions
found_versions=()

git log --oneline --follow -- package.json | while read commit_hash commit_msg; do
    version=$(git show "$commit_hash:package.json" | jq -r '.version')
    
    if [ -n "$version" ] && [ "$version" != "null" ] && [ -z "${versions[$version]}" ]; then
        versions[$version]=1
        
        runs=$(gh run list --commit="$commit_hash" --json databaseId,status,conclusion --jq '.[] | select(.status == "completed" and .conclusion == "success") | .databaseId')
        
        for run_id in $runs; do
            artifacts=$(gh run view "$run_id" --json artifacts --jq '.artifacts[] | select(.name | test("typedoc-.*\\.tar\\.gz")) | .name')
            
            for artifact_name in $artifacts; do
                case "$artifact_name" in
                    "typedoc-$version.tar.gz")
                        gh run download "$run_id" --name "$artifact_name" --dir temp
                        mkdir -p "existing-typedoc/v$version"
                        tar -xzf "temp/$artifact_name" -C "existing-typedoc/v$version"
                        rm -rf temp
                        found_versions+=("v$version")
                        ;;
                    "typedoc-$version.tar.gz-dev")
                        gh run download "$run_id" --name "$artifact_name" --dir temp
                        mkdir -p "existing-typedoc-dev/v$version"
                        tar -xzf "temp/$artifact_name" -C "existing-typedoc-dev/v$version"
                        rm -rf temp
                        ;;
                esac
            done
            
            [ ${#found_versions[@]} -gt 0 ] && break
        done
    fi
done

if [ ${#found_versions[@]} -gt 0 ]; then
    printf '%s\n' "${found_versions[@]}" | jq -R . | jq -s '{"versions": .}' > existing-typedoc/.typedoc-plugin-versions
    printf '%s\n' "${found_versions[@]}" | jq -R . | jq -s '{"versions": .}' > existing-typedoc-dev/.typedoc-plugin-versions
else
    echo '{"versions": []}' > existing-typedoc/.typedoc-plugin-versions
    echo '{"versions": []}' > existing-typedoc-dev/.typedoc-plugin-versions
fi
