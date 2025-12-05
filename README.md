# HomeTeacher

**メタリポジトリ - 統合管理・ビルド・デプロイ専用**

このリポジトリはソースコードを含まず、必要な依存リポジトリを自動的にcloneして統合ビルド・デプロイを行うための管理リポジトリです。

AI-powered learning support app with handwriting and PDF annotation features.

## 🎯 Versions

TutoTuto is available in two versions:

### 📚 TutoTuto (Kids Version)
For elementary school students with AI grading and SNS rewards.

**[Launch TutoTuto →](https://thousandsofties.github.io/HomeTeacher/)**

### 💼 TutoTuto Discuss (Adult Version)
For university students and professionals focused on note-taking and discussion.

**[Launch TutoTuto Discuss →](https://thousandsofties.github.io/HomeTeacher/discuss/)**

## ✨ Features

- 📝 **PDF Annotation**: Write directly on PDF files with Apple Pencil
- 🔄 **Scratch to Erase**: Scribble over lines to erase them
- ✅ **AI Grading** (Kids version only): Automatic homework grading
- 🎮 **SNS Rewards** (Kids version only): Unlock social media after completing work
- 💾 **Auto-save**: All your annotations are saved automatically
- 📱 **PWA Support**: Install as a standalone app on your device

## 🏗️ プロジェクト構成

```
HomeTeacher/ (このリポジトリ - メタリポジトリ)
├── package.json        # npm workspaces設定
├── Makefile            # 統合ビルド管理
├── Repos.mk            # 依存リポジトリ定義
├── .github/workflows/  # GitHub Pages自動デプロイ
└── repos/              # 依存リポジトリ（自動clone、gitignore）
    ├── drawing-common/      # 描画共通ライブラリ
    └── home-teacher-core/   # HomeTeacherアプリ本体
```

### ⚙️ npm Workspaces

このプロジェクトは **npm workspaces** を使用して複数のリポジトリを統合管理しています。

- `npm install` を実行すると、すべてのworkspace（drawing-common、home-teacher-core）の依存関係が一括インストールされます
- home-teacher-coreからdrawing-commonへの参照は自動的に解決されます
- ルートの `package.json` でビルドスクリプトを一元管理できます

### 📦 依存リポジトリ

1. **drawing-common** - 描画機能の共通ライブラリ
   - https://github.com/ThousandsOfTies/drawing-common

2. **home-teacher-core** - HomeTeacherアプリケーション本体
   - https://github.com/ThousandsOfTies/home-teacher-core

## 🚀 クイックスタート

### 初回セットアップ

```bash
git clone https://github.com/ThousandsOfTies/HomeTeacher.git
cd HomeTeacher
make setup
```

### 開発

```bash
# Kids版を開発モードで起動
make dev

# Discuss版を開発モードで起動
make dev:discuss

# 全バージョンをビルド
make build:all

# Kids版のみビルド
make build:kids

# Discuss版のみビルド
make build:discuss
```

### 主要コマンド

```bash
make help             # ヘルプ表示
make clone            # 依存リポジトリをクローン
make pull             # 依存リポジトリを最新に更新
make install          # すべての依存関係をインストール
make clean            # ビルド成果物を削除
make clean-all        # 完全削除（repos/含む）
make status           # すべてのリポジトリのgitステータス表示
```

## 📤 GitHub Pagesへのデプロイ

### 自動デプロイ

mainブランチにpushすると、GitHub Actionsが自動的に以下を実行：

1. 依存リポジトリを自動clone
2. 依存関係をインストール
3. すべてのリポジトリをビルド
4. GitHub Pagesにデプロイ

```bash
git add .
git commit -m "chore: ビルド設定を更新"
git push origin main
```

### デプロイ先URL

- **Kids版**: https://thousandsofties.github.io/HomeTeacher/
- **Discuss版**: https://thousandsofties.github.io/HomeTeacher/discuss/

### 初回デプロイ設定

1. GitHubリポジトリの **Settings** → **Pages**
2. **Source** を **GitHub Actions** に変更
3. **Settings** → **Actions** → **General**
4. **Workflow permissions** で **Read and write permissions** を選択

詳細は [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) を参照してください。

### PWA Features

TutoTuto is a Progressive Web App with:
- **Offline support** via Service Worker caching
- **Installable** - Add to home screen on mobile/desktop
- **Auto-updates** - New versions load automatically
- **Fast loading** - Optimized chunks and caching

## 🛠️ Technology Stack

### メタリポジトリ（このリポジトリ）
- **Make**: タスク管理
- **GitHub Actions**: CI/CD

### home-teacher-core
- **Framework**: React 18 + TypeScript
- **Build tool**: Vite
- **Canvas library**: Fabric.js
- **PDF rendering**: PDF.js
- **AI**: Google Gemini API
- **PWA**: vite-plugin-pwa (Workbox)

### drawing-common
- TypeScript
- Canvas API
- React Hooks

## 🔧 新しい依存リポジトリの追加

[Repos.mk](Repos.mk) を編集して追加します：

```makefile
REPOSITORIES := \
	drawing-common|ThousandsOfTies/drawing-common|main \
	home-teacher-core|ThousandsOfTies/home-teacher-core|main \
	new-library|ThousandsOfTies/new-library|main
```

形式: `リポジトリ名|GitHubユーザー/リポジトリ|ブランチ`

## 🤝 コントリビューション

### メタリポジトリへの変更

ビルド設定やデプロイ設定の変更：

1. このリポジトリをフォーク
2. Makefile や Repos.mk を編集
3. Pull Requestを作成

### アプリケーションへの変更

機能追加やバグ修正：

1. **home-teacher-core** リポジトリで作業
2. 変更をコミット＆プッシュ
3. このメタリポジトリで `make pull` して最新版を取得

## 🆘 サポート

問題が発生した場合は、各リポジトリのIssuesで報告してください：

- メタリポジトリの問題: https://github.com/ThousandsOfTies/HomeTeacher/issues
- アプリの問題: https://github.com/ThousandsOfTies/home-teacher-core/issues
- 描画機能の問題: https://github.com/ThousandsOfTies/drawing-common/issues

