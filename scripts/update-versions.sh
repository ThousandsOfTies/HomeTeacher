#!/bin/bash
# サブリポジトリのコミットIDをVERSIONSファイルに記録

REPOS_DIR="repos"

echo "# 依存リポジトリのバージョン" > VERSIONS
echo "# 更新: make update-versions" >> VERSIONS
echo "" >> VERSIONS

# drawing-common
if [ -d "$REPOS_DIR/drawing-common/.git" ]; then
    COMMIT=$(cd "$REPOS_DIR/drawing-common" && git rev-parse HEAD)
    echo "drawing-common=$COMMIT" >> VERSIONS
else
    echo "drawing-common=" >> VERSIONS
fi

# home-teacher-core
if [ -d "$REPOS_DIR/home-teacher-core/.git" ]; then
    COMMIT=$(cd "$REPOS_DIR/home-teacher-core" && git rev-parse HEAD)
    echo "home-teacher-core=$COMMIT" >> VERSIONS
else
    echo "home-teacher-core=" >> VERSIONS
fi

echo "VERSIONSファイルを更新しました:"
cat VERSIONS
