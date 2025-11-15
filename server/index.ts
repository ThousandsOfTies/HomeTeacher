import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config()

const app = express()
const port = process.env.PORT || 3003

// CORS設定（セキュリティ強化版）
const allowedOrigins = [
  // 本番環境（GitHub Pages）
  'https://thousandsofties.github.io',

  // 開発環境（localhost全般を許可）
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
]

app.use(cors({
  origin: (origin, callback) => {
    // originがundefined = 同一オリジンリクエスト（許可）
    if (!origin) return callback(null, true)

    // 許可リストチェック（文字列またはRegex）
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin
      } else {
        return allowed.test(origin)
      }
    })

    if (isAllowed) {
      callback(null, true)
    } else {
      console.warn(`🚫 CORS blocked: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['POST', 'GET'],
  credentials: false
}))

app.use(express.json({ limit: '50mb' }))

// Gemini APIクライアント
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// シンプルなレート制限（メモリベース）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15分
const RATE_LIMIT_MAX = 20 // 15分間に20リクエストまで

const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    // 新規または期限切れ
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX) {
    // 制限超過
    return false
  }

  // カウント増加
  record.count++
  return true
}

// 採点エンドポイント
app.post('/api/grade', async (req, res) => {
  // レート制限チェック（IPアドレスベース）
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'リクエストが多すぎます',
      details: '15分後に再度お試しください'
    })
  }
  try {
    const { imageData, pageNumber, problemContext } = req.body

    if (!imageData) {
      return res.status(400).json({ error: '画像データが必要です' })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-api-key-here') {
      return res.status(500).json({
        error: 'Gemini APIキーが設定されていません',
        details: '.envファイルにGEMINI_API_KEYを設定してください'
      })
    }

    // Base64からメディアタイプとデータを抽出
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!base64Match) {
      return res.status(400).json({ error: '無効な画像データ形式です' })
    }

    const mimeType = `image/${base64Match[1]}`
    const base64Data = base64Match[2]

    // Gemini 2.0 Flash モデルを使用（最新・最速モデル）
    // 開発環境: gemini-2.0-flash-exp (最速、実験版)
    // 本番環境: gemini-2.0-flash (安定版) - .envで切り替え可能
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    console.log(`🤖 使用モデル: ${modelName}`)
    
    // 生成パラメータを超積極的に最適化（最速設定）
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1, // 最小限に設定（決定論的応答で高速化）
        maxOutputTokens: 1024, // さらに制限して高速化
        topP: 0.5, // 大幅に絞って高速化
        topK: 20, // トップK個のトークンのみ考慮
      }
    })

    const prompt = `画像の問題を採点し、以下のJSON形式で回答してください:
{"problems":[{"problemNumber":"問題番号","studentAnswer":"赤ペンの解答","isCorrect":true/false,"correctAnswer":"正解","feedback":"コメント","explanation":"解説"}],"overallComment":"全体評価"}`

    // Gemini APIにリクエスト（リトライ機能付き）- 高速化のためリトライを削減
    let result
    let lastError
    const maxRetries = 1 // リトライなし（初回のみ）
    const retryDelay = 500 // 待機時間を最小化

    const startTime = Date.now()
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`⏱️ 採点リクエスト開始...`)
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          prompt
        ])
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`✅ APIレスポンス: ${elapsedTime}秒`)
        break // 成功したらループを抜ける
      } catch (error: any) {
        lastError = error
        console.error(`試行 ${attempt} 失敗:`, error.message)

        // 503エラー（過負荷）の場合のみリトライ
        if (error.status === 503 && attempt < maxRetries) {
          console.log(`${retryDelay}ms待機してリトライします...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } else {
          // その他のエラーまたは最後の試行の場合は中断
          throw error
        }
      }
    }

    if (!result) {
      throw lastError
    }

    const response = await result.response
    const responseText = response.text()

    // デバッグ用：生の応答をログ出力
    console.log('=== Gemini API 応答 ===')
    console.log(responseText.substring(0, 500) + '...') // 最初の500文字
    console.log('=====================')

    // JSONを抽出（```json ... ``` の形式に対応）
    let gradingResult
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      gradingResult = JSON.parse(jsonMatch[1])
    } else {
      // JSON形式を直接探す
      try {
        const jsonStart = responseText.indexOf('{')
        const jsonEnd = responseText.lastIndexOf('}') + 1
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          gradingResult = JSON.parse(responseText.substring(jsonStart, jsonEnd))
        } else {
          throw new Error('JSON not found')
        }
      } catch {
        // JSON形式でない場合は、テキストをそのまま返す
        gradingResult = {
          problems: [],
          overallComment: responseText,
          rawResponse: responseText
        }
      }
    }

    res.json({
      success: true,
      result: gradingResult,
    })
  } catch (error) {
    console.error('採点エラー:', error)
    res.status(500).json({
      error: '採点処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiApiKey: process.env.GEMINI_API_KEY ? '設定済み' : '未設定'
  })
})

// 利用可能なモデル一覧を取得
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    )
    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({
      error: 'モデル一覧の取得に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    })
  }
})

app.listen(port, () => {
  console.log(`\n🚀 APIサーバーが起動しました!`)
  console.log(`   http://localhost:${port}`)
  console.log(`\n🤖 Gemini API Key: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-api-key-here' ? '設定済み ✅' : '未設定 ❌'}`)
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-api-key-here') {
    console.log('\n⚠️  .envファイルにGEMINI_API_KEYを設定してください')
    console.log('   https://makersuite.google.com/app/apikey\n')
  }
})
