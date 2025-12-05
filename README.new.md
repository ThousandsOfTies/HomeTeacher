# HomeTeacher

AI-powered drill grading app with handwriting support

## 🏗️ プロジェクト構成

このプロジェクトは**メタリポジトリ**方式を採用しています。必要な依存リポジトリを自動的にcloneして統合ビルドを行います。

```
HomeTeacher/
├── Makefile             # 統合ビルド管理
├── Repos.mk            # 依存リポジトリ定義
├── src/                # HomeTeacher本体のコード
├── repos/              # 依存リポジトリ（自動clone、gitignore）
│   └── drawing-common/ # 描画共通ライブラリ（自動管理）
└── dist/               # ビルド成果物
```

### 依存リポジトリ

- **drawing-common**: 描画機能の共通ライブラリ
  - https://github.com/ThousandsOfTies/drawing-common

## 🚀 クイックスタート

### 初回セットアップ

```bash
git clone https://github.com/ThousandsOfTies/HomeTeacher.git
cd HomeTeacher
make setup
```

これだけで、依存リポジトリのclone、インストール、ビルドが完了します。

### 開発を始める

```bash
# Kids版（デフォルト）
make dev

# Discuss版
make dev:discuss
```

ブラウザで http://localhost:3000 が自動的に開きます。

## 📦 主要なコマンド

### 開発関連

```bash
make dev              # Kids版を開発モードで起動
make dev:discuss      # Discuss版を開発モードで起動
make build            # 本番ビルド（Kids版）
make build:all        # 全バージョンをビルド
```

### 依存関係管理

```bash
make clone            # 依存リポジトリをクローン
make pull             # 依存リポジトリを最新に更新
make install          # すべての依存関係をインストール
```

### メンテナンス

```bash
make clean            # ビルド成果物を削除
make clean-all        # 完全削除（repos/、node_modules含む）
make status           # すべてのリポジトリのgitステータス表示
make help             # ヘルプ表示
```

## 🔄 開発フロー

### 通常の開発

```bash
# 1. 開発サーバー起動
make dev

# 2. コードを編集

# 3. ビルドして確認
make build
```

### 依存ライブラリ（drawing-common）を更新する場合

```bash
# 1. 依存リポジトリを最新に更新
make pull

# 2. 再インストール
make install

# 3. 開発サーバー起動
make dev
```

### drawing-commonを直接編集したい場合

```bash
# repos/drawing-common は通常のgitリポジトリとして扱えます
cd repos/drawing-common

# コードを編集
# ...

# コミット＆プッシュ
git add .
git commit -m "feat: 新機能追加"
git push origin main

# HomeTeacherに戻って最新版を取得
cd ../..
make pull
make install
```

## 📤 GitHub Pagesへのデプロイ

### 自動デプロイ

mainブランチにpushすると、GitHub Actionsが自動的にビルド＆デプロイを実行します：

```bash
git add .
git commit -m "feat: 新機能追加"
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

### drawing-commonの変更が反映されない

```bash
make pull
make install
make build
```

### repos/がgitに追加されてしまう

`.gitignore`に`repos/`が含まれているか確認してください。

## 📚 技術スタック

### フロントエンド
- React + TypeScript
- Vite
- PWA対応（Service Worker、マニフェスト）

### 主要ライブラリ
- **PDF.js**: PDF表示
- **Fabric.js**: Canvas描画
- **Google Gemini API**: AI採点
- **IndexedDB**: ローカルデータ保存

### 依存リポジトリ
- **@thousands-of-ties/drawing-common**: 描画機能の共通ライブラリ

## 🔧 設定ファイル

### Repos.mk

依存リポジトリを定義します。新しい依存を追加する場合：

```makefile
REPOSITORIES := \
	drawing-common|ThousandsOfTies/drawing-common|main \
	new-lib|ThousandsOfTies/new-lib|main
```

形式: `リポジトリ名|GitHubユーザー/リポジトリ|ブランチ`

### package.json

依存リポジトリは`file:`プロトコルで参照：

```json
{
  "dependencies": {
    "@thousands-of-ties/drawing-common": "file:./repos/drawing-common"
  }
}
```

## 📖 関連ドキュメント

- [GitHub Pages デプロイガイド](GITHUB_PAGES_SETUP.md)
- [完全なデプロイガイド](DEPLOYMENT.md)
- [使い方](USAGE.md)

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

MIT License

## 🆘 サポート

問題が発生した場合は、[Issues](https://github.com/ThousandsOfTies/HomeTeacher/issues)で報告してください。
