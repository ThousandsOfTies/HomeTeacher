# 完全メタリポジトリ構成への移行手順

このドキュメントは、現在のHomeTeacherリポジトリを完全なメタリポジトリ構成に移行する手順を説明します。

## 📋 移行概要

### 現在の構成
```
HomeTeacher/
├── src/                # アプリのソースコード（ここにある）
├── package.json
├── vite.config.ts
└── ...
```

### 移行後の構成
```
HomeTeacher/ (メタリポジトリ)
├── Makefile            # 統合ビルド管理のみ
├── Repos.mk            # 依存リポジトリ定義のみ
├── .github/workflows/  # デプロイ設定のみ
└── repos/              # すべてのソースコード（gitignore）
    ├── drawing-common/
    └── home-teacher-core/  # 元々のsrc/などがここに
```

## 🚀 移行手順

### ステップ1: home-teacher-coreリポジトリを作成

1. GitHubで新しいリポジトリを作成
   - リポジトリ名: `home-teacher-core`
   - 説明: HomeTeacher application core
   - Private/Publicは任意

2. ローカルで現在のHomeTeacherのソースコードを準備

```bash
cd c:/VibeCode/HomeTeacher

# 移行するファイル・ディレクトリのリスト
# src/, public/, server/, scripts/, package.json, vite.config.ts, tsconfig.json, etc.
```

### ステップ2: home-teacher-coreにコードを移動

```bash
# 一時作業ディレクトリを作成
cd c:/VibeCode
mkdir -p home-teacher-core-temp
cd home-teacher-core-temp

# 新しいリポジトリを初期化
git init
git remote add origin https://github.com/ThousandsOfTies/home-teacher-core.git

# HomeTeacherからファイルをコピー
cp -r ../HomeTeacher/src ./
cp -r ../HomeTeacher/public ./
cp -r ../HomeTeacher/server ./
cp -r ../HomeTeacher/scripts ./
cp ../HomeTeacher/package.json ./
cp ../HomeTeacher/package-lock.json ./
cp ../HomeTeacher/vite.config.ts ./
cp ../HomeTeacher/tsconfig.json ./
cp ../HomeTeacher/tsconfig.node.json ./
cp ../HomeTeacher/index.html ./
cp ../HomeTeacher/.env.example ./
cp ../HomeTeacher/.env.kids ./
cp ../HomeTeacher/.env.discuss ./
cp ../HomeTeacher/.env.production.example ./
cp ../HomeTeacher/Dockerfile ./
cp ../HomeTeacher/deploy-cloud-run.sh ./

# .gitignoreを作成
cat > .gitignore << 'EOF'
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
deploy
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment variables
.env
.env.local
.env.production

# PDF files
PDFs/
EOF

# package.jsonを更新（drawing-commonの参照を修正）
# file:./repos/drawing-common -> github:ThousandsOfTies/drawing-common#main
# または file:../drawing-common

# 初回コミット
git add .
git commit -m "feat: initial commit - HomeTeacher core application"
git branch -M main
git push -u origin main
```

### ステップ3: package.jsonの依存関係を調整

home-teacher-core/package.jsonで、drawing-commonの参照を更新：

```json
{
  "dependencies": {
    "@thousands-of-ties/drawing-common": "file:../drawing-common"
  }
}
```

これにより、`repos/`内で相対パスで参照できます。

### ステップ4: HomeTeacherリポジトリをクリーンアップ

```bash
cd c:/VibeCode/HomeTeacher

# 不要なファイルを削除（package.jsonは残す場合がある）
rm -rf src/ public/ server/ scripts/
rm -f index.html vite.config.ts tsconfig.json tsconfig.node.json
rm -f Dockerfile deploy-cloud-run.sh
rm -f .env.kids .env.discuss .env.production.example
rm -rf node_modules dist deploy

# 既に更新済みのファイルは残す
# - Makefile
# - Repos.mk
# - .gitignore
# - .github/workflows/deploy.yml
# - README.md
```

### ステップ5: package.jsonを削除または最小化

メタリポジトリにはpackage.jsonは不要なので削除：

```bash
cd c:/VibeCode/HomeTeacher
rm -f package.json package-lock.json
```

### ステップ6: 動作確認

```bash
cd c:/VibeCode/HomeTeacher

# 依存リポジトリをクローン
make clone

# これでrepos/home-teacher-coreがcloneされる
# （まだリポジトリが作成されていない場合はエラーになる）

# インストール＆ビルド
make install
make build:kids

# 開発サーバー起動
make dev
```

### ステップ7: コミット＆プッシュ

```bash
cd c:/VibeCode/HomeTeacher

git add .
git commit -m "refactor: convert to meta-repository structure"
git push origin main
```

## 🔍 移行後の確認事項

### ✅ 確認リスト

- [ ] repos/drawing-common がcloneされる
- [ ] repos/home-teacher-core がcloneされる
- [ ] `make install` が成功する
- [ ] `make build:kids` が成功する
- [ ] `make build:discuss` が成功する
- [ ] `make dev` で開発サーバーが起動する
- [ ] GitHub Actionsでビルドが成功する
- [ ] GitHub Pagesにデプロイされる

### トラブルシューティング

#### repos/home-teacher-coreがcloneできない

```bash
# リポジトリが作成されているか確認
# https://github.com/ThousandsOfTies/home-teacher-core

# 手動でclone
cd c:/VibeCode/HomeTeacher/repos
git clone https://github.com/ThousandsOfTies/home-teacher-core.git
```

#### drawing-commonの参照エラー

home-teacher-core/package.jsonで相対パス参照を確認：

```json
{
  "dependencies": {
    "@thousands-of-ties/drawing-common": "file:../drawing-common"
  }
}
```

#### ビルドエラー

```bash
# 完全クリーンアップ
make clean-all

# 再セットアップ
make setup
```

## 📦 各リポジトリの役割

### HomeTeacher（メタリポジトリ）
- **役割**: 統合管理・ビルド・デプロイ
- **含むもの**: Makefile、Repos.mk、GitHub Actions設定
- **含まないもの**: ソースコード、package.json

### home-teacher-core
- **役割**: アプリケーション本体
- **含むもの**: src/, package.json, vite.config.ts, etc.
- **依存**: drawing-common (相対パス `file:../drawing-common`)

### drawing-common
- **役割**: 共通ライブラリ
- **含むもの**: 描画機能のReact Hooks、型定義
- **依存**: なし

## 🎯 移行のメリット

1. ✅ **単一リポジトリでセットアップ完了**: `git clone HomeTeacher && make setup`
2. ✅ **依存関係が明示的**: Repos.mkで一元管理
3. ✅ **コードの再利用性向上**: drawing-common、home-teacher-coreを他のプロジェクトでも利用可能
4. ✅ **GitHub Actions簡素化**: メタリポジトリの設定のみ更新すればOK

## 📝 注意事項

- **package.json削除**: メタリポジトリにはpackage.jsonは不要
- **repos/はgitignore**: すべてのソースコードはrepos/配下で管理
- **相対パス参照**: home-teacher-coreからdrawing-commonは`file:../drawing-common`で参照

## 🆘 ヘルプ

移行中に問題が発生した場合は、Issuesで報告してください：
https://github.com/ThousandsOfTies/HomeTeacher/issues
