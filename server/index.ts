import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'

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
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}))

app.use(express.json({ limit: '50mb' }))

// Gemini APIクライアント (新SDK)
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY || ''})

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
    const { imageData, pageNumber, problemContext, language } = req.body

    if (!imageData) {
      return res.status(400).json({ error: '画像データが必要です' })
    }

    // 言語マッピング（navigator.language → 言語名）
    const languageMap: Record<string, string> = {
      'ja': 'Japanese',
      'en': 'English',
      'zh': 'Chinese',
      'ko': 'Korean',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
    }

    // 言語コードの最初の部分を取得（例: 'en-US' → 'en'）
    const langCode = language ? language.split('-')[0] : 'ja'
    const responseLang = languageMap[langCode] || 'Japanese'

    console.log(`🌍 ユーザー言語: ${language} → レスポンス言語: ${responseLang}`)

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

    // デバッグ: 画像を保存
    const debugImagePath = './debug-image.jpg'
    fs.writeFileSync(debugImagePath, Buffer.from(base64Data, 'base64'))
    console.log(`🖼️ デバッグ画像を保存: ${debugImagePath}`)

    // Gemini 3.0 Pro モデルを使用（最新・最高精度）
    // 優先: gemini-3-pro-preview (Gemini 3.0、数学20倍改善)
    // フォールバック: gemini-2.0-flash (安定版、コスト重視)
    // .envで GEMINI_MODEL を設定して切り替え可能
    const preferredModelName = process.env.GEMINI_MODEL || 'gemini-3-pro-preview'
    const fallbackModelName = 'gemini-2.0-flash'

    console.log(`🤖 優先モデル: ${preferredModelName}`)

    const prompt = `You are an experienced teacher grading student work. Please carefully analyze this image and grade each problem with attention to detail.

CRITICAL: You MUST look at the ACTUAL IMAGE provided. Do NOT make up problems or answers that are not in the image. Only grade what you actually see in the image.

INSTRUCTIONS:
1. First, describe what you see in the image:
   - What type of problem is shown? (geometry, arithmetic, word problem, etc.)
   - What diagrams, shapes, or figures are visible?
   - What numbers, labels, or text appear in the problem?
   - What handwritten answers or work do you see from the student?

2. Carefully examine the image to identify:
   - The original problem statement/question (transcribe it exactly as shown)
   - The student's handwritten answer (transcribe exactly what you see)
   - Any working/calculations shown by the student

3. For each problem, evaluate:
   - Is the final answer correct?
   - Is the reasoning/method appropriate?
   - Are there any partial credits for correct approach even if final answer is wrong?
   - For math problems: Check calculations, units, and mathematical notation
   - For written answers: Check completeness, accuracy, and understanding
   - For geometry/diagram problems: Carefully read all numbers, labels, and text EXACTLY as written in the image
   - For dice/cube problems: Use ONLY the numbers actually shown in the net/diagram, do not assume standard dice numbering

4. Grading criteria:
   - Mark as CORRECT (isCorrect: true) if the answer is correct and the method is valid
   - Mark as INCORRECT (isCorrect: false) if the answer is wrong or the method has fundamental errors
   - For ambiguous handwriting, make your best interpretation and note any uncertainty in feedback
   - Consider partial credit in your feedback even when marking incorrect
   - IMPORTANT: Base your grading on what is ACTUALLY WRITTEN in the image, not on general knowledge or assumptions
   - Do not apply external rules (like standard dice numbering) unless the problem explicitly references them

5. Provide helpful feedback:
   - For correct answers: Acknowledge what was done well
   - For incorrect answers: Explain what went wrong and provide the correct approach
   - Be encouraging and educational
   - Point out common mistakes if applicable

6. Return your response in the following JSON format:
{
  "problems": [
    {
      "problemNumber": "Question/problem identifier (e.g., '問1', 'Q1', 'Problem 1')",
      "problemText": "The original problem statement from the image",
      "studentAnswer": "Student's written answer (transcribe exactly what you see)",
      "isCorrect": true or false,
      "correctAnswer": "The correct answer if student was incorrect",
      "feedback": "Brief, specific comment on the student's work",
      "explanation": "Detailed explanation of the solution and why the student's answer is correct/incorrect"
    }
  ],
  "overallComment": "Overall evaluation of the student's performance across all problems"
}

CRITICAL: All text content (problemText, studentAnswer, feedback, explanation, overallComment, etc.) MUST be written in ${responseLang}.
If you cannot read certain handwriting, indicate this clearly in your feedback in ${responseLang}.

Please respond ONLY with valid JSON. Do not include markdown code blocks or any text outside the JSON structure.`

    // Gemini APIにリクエスト（モデルフォールバック機能付き）
    let result
    let lastError
    let usedModelName = preferredModelName
    const startTime = Date.now()

    // 優先モデルで試行
    try {
      console.log(`⏱️ 採点リクエスト開始 (${preferredModelName})...`)

      result = await ai.models.generateContent({
        model: preferredModelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          temperature: 0.4, // 適度な柔軟性を持たせる
          maxOutputTokens: 8192, // 詳細なフィードバックのために大幅増量
          topP: 0.95, // デフォルト値に近い設定
          topK: 40, // デフォルト値
        }
      })

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ APIレスポンス (${preferredModelName}): ${elapsedTime}秒`)
    } catch (error: any) {
      lastError = error
      console.warn(`⚠️ ${preferredModelName} で失敗:`, error.message)

      // フォールバックモデルで再試行（優先モデルと異なる場合のみ）
      if (preferredModelName !== fallbackModelName) {
        try {
          console.log(`🔄 フォールバック: ${fallbackModelName} で再試行...`)

          result = await ai.models.generateContent({
            model: fallbackModelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            config: {
              temperature: 0.4,
              maxOutputTokens: 8192,
              topP: 0.95,
              topK: 40,
            }
          })

          usedModelName = fallbackModelName
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
          console.log(`✅ APIレスポンス (${fallbackModelName}): ${elapsedTime}秒`)
        } catch (fallbackError: any) {
          console.error(`❌ ${fallbackModelName} でも失敗:`, fallbackError.message)
          throw fallbackError
        }
      } else {
        throw error
      }
    }

    if (!result) {
      throw lastError
    }

    console.log(`📊 使用されたモデル: ${usedModelName}`)

    // 新SDKのレスポンス取得方法
    // @google/genai SDK では candidates[0].content.parts[0].text からテキストを取得
    let responseText = ''

    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0]

      // finishReasonを確認
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('⚠️ 警告: 最大トークン数に達しました。maxOutputTokensを増やします')
      }

      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        responseText = candidate.content.parts[0].text || ''
      }
    }

    if (!responseText) {
      console.error('❌ レスポンスにテキストが含まれていません')
      console.log('result全体:', JSON.stringify(result, null, 2).substring(0, 1000))
      throw new Error('Gemini APIからテキストレスポンスを取得できませんでした')
    }

    // デバッグ用：生の応答をログ出力
    console.log('=== Gemini API 応答 ===')
    console.log(responseText.substring(0, 500) + '...') // 最初の500文字
    console.log('テキスト長:', responseText.length)
    console.log('=====================')

    // JSONを抽出（プロンプトでmarkdownブロック禁止を指示しているが、念のため両対応）
    let gradingResult

    // まずmarkdown形式を試す（```json ... ```）
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      try {
        gradingResult = JSON.parse(jsonMatch[1])
        console.log('✅ JSON抽出成功 (markdown形式)')
      } catch (parseError) {
        console.warn('⚠️ Markdownブロック内のJSONパースに失敗:', parseError)
        gradingResult = null
      }
    }

    // markdownブロックがないか、パースに失敗した場合は直接JSON抽出を試す
    if (!gradingResult) {
      try {
        const jsonStart = responseText.indexOf('{')
        const jsonEnd = responseText.lastIndexOf('}') + 1
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonString = responseText.substring(jsonStart, jsonEnd)
          gradingResult = JSON.parse(jsonString)
          console.log('✅ JSON抽出成功 (直接形式)')
        } else {
          throw new Error('JSON構造が見つかりません')
        }
      } catch (parseError) {
        console.error('❌ JSONパース失敗:', parseError)
        // JSON形式でない場合は、テキストをそのまま返す
        gradingResult = {
          problems: [],
          overallComment: responseText,
          rawResponse: responseText
        }
        console.warn('⚠️ フォールバック: 生テキストを返します')
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
