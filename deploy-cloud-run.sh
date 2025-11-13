#!/bin/bash

# Cloud Run デプロイスクリプト
# 使用方法: ./deploy-cloud-run.sh

# 設定
PROJECT_ID="hometeacher-478013"  # ← GCPプロジェクトIDに置き換えてください
SERVICE_NAME="hometeacher-api"
REGION="asia-northeast1"  # 東京リージョン
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 HomeTeacher API を Cloud Run にデプロイします"
echo "   Project: ${PROJECT_ID}"
echo "   Service: ${SERVICE_NAME}"
echo "   Region: ${REGION}"
echo ""

# Google Cloud CLIがインストールされているか確認
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI (gcloud) がインストールされていません"
    echo "   https://cloud.google.com/sdk/docs/install からインストールしてください"
    exit 1
fi

# プロジェクトを設定
echo "📝 GCPプロジェクトを設定中..."
gcloud config set project ${PROJECT_ID}

# Docker イメージをビルド
echo "🔨 Dockerイメージをビルド中..."
docker build -t ${IMAGE_NAME} .

# イメージを Container Registry にプッシュ
echo "📤 イメージを Container Registry にプッシュ中..."
docker push ${IMAGE_NAME}

# Cloud Run にデプロイ
echo "🚢 Cloud Run にデプロイ中..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 60

echo ""
echo "✅ デプロイ完了！"
echo ""
echo "📍 サービスURL:"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
echo ""
echo "💡 フロントエンドの .env ファイルに以下を追加してください:"
echo "   VITE_API_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')"
