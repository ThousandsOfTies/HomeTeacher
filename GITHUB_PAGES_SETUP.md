# GitHub Pages デプロイ - クイックスタートガイド

このガイドでは、TutoTutoをGitHub Pagesにデプロイするための最小限の手順を説明します。

## ✅ 完了している設定

以下の設定はすでに完了しています：

- [x] PWAマニフェスト設定（[vite.config.ts](vite.config.ts)）
- [x] Service Worker設定（自動生成）
- [x] GitHub Actionsワークフロー（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）
- [x] Base URLの設定（`/HomeTeacher/`）
- [x] ビルド最適化とチャンク分割
- [x] アイコン生成スクリプト

## 🚀 デプロイ手順（3ステップ）

### ステップ1: GitHubリポジトリの設定

1. GitHub上で https://github.com/ThousandsOfTies/HomeTeacher を開く
2. **Settings** → **Pages** に移動
3. **Source** を **GitHub Actions** に変更

### ステップ2: GitHub Actionsのパーミッション設定

1. **Settings** → **Actions** → **General** に移動
2. **Workflow permissions** セクションで **Read and write permissions** を選択
3. **Save** をクリック

### ステップ3: デプロイ実行

```bash
git add .
git commit -m "feat: PWA対応とGitHub Pages設定を追加"
git push origin main
```

## 🎉 完了！

デプロイが完了すると、以下のURLでアクセスできます：

- **Kids版**: https://thousandsofties.github.io/HomeTeacher/
- **Discuss版**: https://thousandsofties.github.io/HomeTeacher/discuss/

## 📊 デプロイ状況の確認

1. リポジトリの **Actions** タブを開く
2. "Deploy to GitHub Pages" ワークフローを確認
3. 通常2-3分で完了

## 🔄 今後の更新

mainブランチにプッシュするだけで自動デプロイされます：

```bash
git add .
git commit -m "update: 新機能を追加"
git push origin main
```

## 🛠️ トラブルシューティング

### デプロイが失敗する

**エラー**: "Resource not accessible by integration"
- **解決策**: ステップ2のパーミッション設定を確認

**エラー**: ビルドエラー
- **解決策**: ローカルで `npm run build` を実行して確認

### ページが表示されない

1. **Settings** → **Pages** で正しいURLが表示されているか確認
2. ブラウザのキャッシュをクリア
3. 数分待ってから再アクセス

### PWAが動作しない

1. HTTPSでアクセスしているか確認（GitHub Pagesは自動的にHTTPS）
2. ブラウザの開発者ツールでService Workerを確認
3. アプリケーションキャッシュをクリアして再読み込み

## 📚 関連ドキュメント

- [完全なデプロイガイド](DEPLOYMENT.md)
- [README](README.md)
- [GitHub Pages公式ドキュメント](https://docs.github.com/pages)

## 💡 Tips

### ローカルでプレビュー

本番ビルドをローカルでテスト：

```bash
npm run build
npm run preview
```

### PWAとしてインストール

デプロイ後、ブラウザのアドレスバーにインストールアイコンが表示されます。

### 開発環境

```bash
# Kids版
npm run dev

# Discuss版
npm run dev:discuss

# サーバーと同時起動
npm run dev:all
```
