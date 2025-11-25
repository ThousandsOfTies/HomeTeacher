# TutoTuto - デプロイガイド

このガイドでは、TutoTutoアプリをGitHub Pages（フロントエンド）とGoogle Cloud Run（バックエンドAPI）にデプロイする手順を説明します。

## 前提条件

1. **Google Cloud Platform (GCP) アカウント**
   - https://cloud.google.com/ でアカウントを作成
   - 新規アカウントは$300の無料クレジットあり

2. **Google Cloud CLI (gcloud)**
   - https://cloud.google.com/sdk/docs/install からインストール

3. **Docker Desktop**
   - https://www.docker.com/products/docker-desktop からインストール

4. **Gemini API キー**
   - https://makersuite.google.com/app/apikey から取得

## バックエンドAPIのデプロイ（Google Cloud Run）

### 1. GCPプロジェクトの作成

```bash
# GCPコンソールでプロジェクトを作成
# プロジェクトID（例: hometeacher-123456）をメモ

# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Gemini API キーをSecret Managerに保存

```bash
# APIキーをシークレットとして作成
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Cloud Runサービスアカウントにシークレットへのアクセス権を付与
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. デプロイスクリプトの設定

`deploy-cloud-run.sh` を編集して、プロジェクトIDを設定：

```bash
PROJECT_ID="your-gcp-project-id"  # ← あなたのプロジェクトIDに置き換え
```

### 4. デプロイの実行

```bash
# スクリプトに実行権限を付与
chmod +x deploy-cloud-run.sh

# デプロイ実行
./deploy-cloud-run.sh
```

### 5. デプロイ後の確認

デプロイが完了すると、サービスURLが表示されます：
```
https://hometeacher-api-xxxxxxxxxx-an.a.run.app
```

このURLをメモしてください。

### 6. 動作確認

```bash
# ヘルスチェック
curl https://YOUR_SERVICE_URL/api/health
```

## フロントエンドの設定更新

### 1. GitHub Secretsにバックエンドのurlを追加

1. GitHubリポジトリページに移動
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** をクリック
4. 以下を追加：
   - Name: `VITE_API_URL`
   - Value: `https://YOUR_SERVICE_URL/api`（Cloud RunのURL）

### 2. GitHub Actionsワークフローの更新

`.github/workflows/deploy.yml` を編集：

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
```

### 3. 変更をコミット＆プッシュ

```bash
git add .
git commit -m "feat: Add Cloud Run backend deployment"
git push origin main
```

GitHub Actionsが自動的にフロントエンドを再ビルド＆デプロイします。

## ローカル開発環境の設定

### バックエンド

```bash
# .env ファイルを作成
cat > .env << EOF
GEMINI_API_KEY=your-api-key-here
PORT=3003
EOF

# サーバー起動
npm run dev:server
```

### フロントエンド

```bash
# .env.local ファイルを作成
cat > .env.local << EOF
VITE_API_URL=http://localhost:3003/api
EOF

# フロントエンド起動
npm run dev
```

または、両方同時に起動：

```bash
npm run dev:all
```

## コスト管理

### Cloud Run の料金

- **無料枠**: 月 200万リクエスト
- **従量課金**: リクエスト数、CPU/メモリ使用量に基づく
- **推定コスト**: 小規模利用なら月$5以下

### 料金を抑えるコツ

1. **最小インスタンス数を0に設定**（デフォルト）
   - 使用がない時は課金されない
2. **メモリ/CPUを最適化**
   - 現在の設定: 512Mi メモリ、1 CPU
3. **タイムアウトを適切に設定**
   - 現在の設定: 60秒

## トラブルシューティング

### バックエンドAPIが応答しない

```bash
# ログを確認
gcloud run logs read hometeacher-api --region asia-northeast1 --limit 50

# サービスの詳細を確認
gcloud run services describe hometeacher-api --region asia-northeast1
```

### CORS エラーが発生する

サーバーコード（`server/index.ts`）のCORS設定を確認：

```typescript
app.use(cors({
  origin: ['https://thousandsofties.github.io'],
  credentials: true
}))
```

### Gemini API キーが機能しない

```bash
# シークレットの値を確認
gcloud secrets versions access latest --secret="GEMINI_API_KEY"

# Cloud Runサービスがシークレットにアクセスできるか確認
gcloud run services describe hometeacher-api \
  --region asia-northeast1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

## 参考リンク

- [Google Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [GitHub Pages ドキュメント](https://docs.github.com/pages)
- [Gemini API ドキュメント](https://ai.google.dev/docs)
