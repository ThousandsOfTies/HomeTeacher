# Cloud Run デプロイスクリプト (PowerShell版)
# 使用方法: .\deploy-cloud-run.ps1

# 設定
$PROJECT_ID = "hometeacher-478013"
$SERVICE_NAME = "hometeacher-api"
$REGION = "asia-northeast1"  # 東京リージョン
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "🚀 HomeTeacher API を Cloud Run にデプロイします" -ForegroundColor Green
Write-Host "   Project: $PROJECT_ID"
Write-Host "   Service: $SERVICE_NAME"
Write-Host "   Region: $REGION"
Write-Host ""

# Google Cloud CLIがインストールされているか確認
try {
    gcloud --version | Out-Null
} catch {
    Write-Host "❌ Google Cloud CLI (gcloud) がインストールされていません" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install からインストールしてください"
    exit 1
}

# プロジェクトを設定
Write-Host "📝 GCPプロジェクトを設定中..." -ForegroundColor Cyan
gcloud config set project $PROJECT_ID

# Docker イメージをビルド
Write-Host "🔨 Dockerイメージをビルド中..." -ForegroundColor Cyan
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dockerイメージのビルドに失敗しました" -ForegroundColor Red
    exit 1
}

# イメージを Container Registry にプッシュ
Write-Host "📤 イメージを Container Registry にプッシュ中..." -ForegroundColor Cyan
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ イメージのプッシュに失敗しました" -ForegroundColor Red
    exit 1
}

# Cloud Run にデプロイ
Write-Host "🚢 Cloud Run にデプロイ中..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 10 `
  --timeout 60

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Runへのデプロイに失敗しました" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ デプロイ完了！" -ForegroundColor Green
Write-Host ""
Write-Host "📍 サービスURL:" -ForegroundColor Cyan
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"
Write-Host "   $SERVICE_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 フロントエンドのGitHub Secretsに以下を追加してください:" -ForegroundColor Cyan
Write-Host "   Name: VITE_API_URL"
Write-Host "   Value: $SERVICE_URL/api" -ForegroundColor Yellow
