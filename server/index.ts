import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config()

const app = express()
const port = process.env.PORT || 3003

// ミドルウェア
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Gemini APIクライアント
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// 採点エンドポイント
app.post('/api/grade', async (req, res) => {
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

    // Gemini 1.5 Flash モデルを使用（安定版）
    // 他のオプション: 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-flash'
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    console.log(`使用モデル: ${modelName}`)
    const model = genAI.getGenerativeModel({ model: modelName })

    const prompt = `あなたは小学5年生の算数を教える優秀な先生です。
画像には算数の問題と、生徒が赤ペンで書いた手書きの解答が含まれています。

【重要な注意事項】
- 手書き文字を丁寧に読み取ってください（赤色のペンで書かれています）
- 計算過程も確認し、途中でミスがないか注意深くチェックしてください
- 問題文をよく読み、何を求められているのか正確に理解してください
- 単位（cm、kg、円など）が必要な場合は、単位も確認してください

【採点手順】
1. 問題文を読み、何を求める問題か理解する
2. 生徒が書いた赤い手書きの解答を読み取る
3. 正しい答えを自分で計算する
4. 生徒の解答と正しい答えを比較する
5. 正解/不正解を判定し、フィードバックを書く

【フィードバックの書き方】
- 正解の場合：具体的に褒めて励ます（例：「正解！計算がとても正確です」）
- 不正解の場合：
  * どこが間違っているか具体的に指摘
  * 正しい解き方を丁寧に説明
  * 励ましの言葉も添える

必ず以下のJSON形式で回答してください：

{
  "problems": [
    {
      "problemNumber": "問題番号（例: 1, 2, (1), (2)など）",
      "problemText": "問題文をそのまま書く",
      "studentAnswer": "生徒が書いた解答（赤い手書き文字）",
      "isCorrect": true または false,
      "correctAnswer": "正しい解答（計算過程も含めて）",
      "feedback": "正解なら褒める、不正解なら間違いを指摘",
      "explanation": "解き方の詳しい説明（ステップバイステップで）"
    }
  ],
  "overallComment": "全体的な励ましのコメント"
}`

    // Gemini APIにリクエスト（リトライ機能付き）
    let result
    let lastError
    const maxRetries = 3
    const retryDelay = 2000 // 2秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`採点リクエスト試行 ${attempt}/${maxRetries}`)
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          prompt
        ])
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
