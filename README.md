# HomeTeacher


**メタリポジトリ - 統合管理・ビルド・デプロイ専用**

AI-powered learning support app with handwriting and PDF annotation features.

## 🎯 Versions

### 📚 TutoTuto (Kids Version)
小学生向け。AI採点とSNS報酬機能付き。

**[Launch TutoTuto →](https://thousandsofties.github.io/HomeTeacher/)**

### 💼 TutoTuto Discuss (Adult Version)
大学生・社会人向け。ノート取りとディスカッションに特化。

**[Launch TutoTuto Discuss →](https://thousandsofties.github.io/HomeTeacher/discuss/)**

## ✨ Features

- 📝 **PDF Annotation**: Apple Pencilで直接PDFに書き込み
- 🔄 **Scratch to Erase**: スクラッチして線を消去
- ✅ **AI Grading** (Kids版のみ): 自動宿題採点
- 🎮 **SNS Rewards** (Kids版のみ): 課題完了でSNS解除
- 💾 **Auto-save**: 自動保存
- 📱 **PWA Support**: スタンドアロンアプリとしてインストール可能

## 🏗️ プロジェクト構成

```
HomeTeacher/ (このリポジトリ - メタリポジトリ)
├── package.json        # メタデータのみ
├── Makefile            # 統合ビルド管理
├── Repos.mk            # 依存リポジトリ定義
├── .github/workflows/  # GitHub Pages自動デプロイ
└── repos/              # 依存リポジトリ（自動clone、gitignore）
    ├── drawing-common/      # 描画共通ライブラリ
    └── home-teacher-core/   # HomeTeacherアプリ本体
```

### 📦 依存リポジトリ

| リポジトリ | 説明 |
|-----------|------|
| [drawing-common](https://github.com/ThousandsOfTies/drawing-common) | 描画機能の共通ライブラリ |
| [home-teacher-core](https://github.com/ThousandsOfTies/home-teacher-core) | HomeTeacherアプリケーション本体 |

## 🚀 クイックスタート

### 初回セットアップ

```bash
git clone https://github.com/ThousandsOfTies/HomeTeacher.git
cd HomeTeacher
make setup
```

### 開発

```bash
make dev              # Kids版を開発モードで起動
make dev:discuss      # Discuss版を開発モードで起動
```

ブラウザで http://localhost:3000 が自動的に開きます。

### ビルド

```bash
make build:kids       # Kids版のみビルド
make build:discuss    # Discuss版のみビルド
make build:all        # 全バージョンをビルド
```

### その他のコマンド

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

mainブランチにpushすると、GitHub Actionsが自動的にビルド＆デプロイを実行：

1. 依存リポジトリを自動clone
2. 各リポジトリの依存関係をインストール（pnpm使用）
3. すべてのリポジトリをビルド
4. GitHub Pagesにデプロイ

### 初回デプロイ設定

1. GitHubリポジトリの **Settings** → **Pages**
2. **Source** を **GitHub Actions** に変更
3. **Settings** → **Actions** → **General**
4. **Workflow permissions** で **Read and write permissions** を選択

詳細は [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) を参照。

## 🛠️ トラブルシューティング

### ビルドエラーが出る

```bash
make clean-all
make setup
```

### 依存リポジトリが見つからない

```bash
make clone
make install
```

### 依存ライブラリの変更が反映されない

```bash
make pull
make install
```

## 🔧 技術スタック

### メタリポジトリ
- **Make**: タスク管理
- **pnpm**: パッケージ管理
- **GitHub Actions**: CI/CD

### home-teacher-core
- **React 18 + TypeScript**
- **Vite**: ビルドツール
- **Fabric.js**: Canvas描画
- **PDF.js**: PDF表示
- **Google Gemini API**: AI採点
- **PWA** (vite-plugin-pwa)

### drawing-common
- TypeScript
- Canvas API
- React Hooks

## 🔧 新しい依存リポジトリの追加

[Repos.mk](Repos.mk) を編集：

```makefile
REPOSITORIES := \
    drawing-common|ThousandsOfTies/drawing-common|main \
    home-teacher-core|ThousandsOfTies/home-teacher-core|main \
    new-library|ThousandsOfTies/new-library|main
```

形式: `リポジトリ名|GitHubユーザー/リポジトリ|ブランチ`

## 🤝 コントリビューション

### メタリポジトリへの変更

1. このリポジトリをフォーク
2. Makefile や Repos.mk を編集
3. Pull Requestを作成

### アプリケーションへの変更

1. **home-teacher-core** リポジトリで作業
2. 変更をコミット＆プッシュ
3. このメタリポジトリで `make pull` して最新版を取得

## 📄 ライセンス

MIT License

## 🆘 サポート

問題が発生した場合は、各リポジトリのIssuesで報告：

- [メタリポジトリの問題](https://github.com/ThousandsOfTies/HomeTeacher/issues)
- [アプリの問題](https://github.com/ThousandsOfTies/home-teacher-core/issues)
- [描画機能の問題](https://github.com/ThousandsOfTies/drawing-common/issues)
