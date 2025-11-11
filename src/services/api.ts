const API_BASE_URL = 'http://localhost:3003/api'

export interface Problem {
  problemNumber: string
  problemText: string
  studentAnswer: string
  isCorrect: boolean
  correctAnswer: string
  feedback: string
  explanation: string
}

export interface GradingResult {
  problems: Problem[]
  overallComment: string
  rawResponse?: string
}

export interface GradeResponse {
  success: boolean
  result: GradingResult
  error?: string
}

export const gradeWork = async (
  imageData: string,
  pageNumber: number,
  problemContext?: string
): Promise<GradeResponse> => {
  try {
    console.log('採点リクエスト送信:', {
      url: `${API_BASE_URL}/grade`,
      pageNumber,
      imageDataSize: imageData.length
    })

    const response = await fetch(`${API_BASE_URL}/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData,
        pageNumber,
        problemContext,
      }),
    })

    console.log('サーバーレスポンス:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    })

    if (!response.ok) {
      // レスポンスボディを取得してエラーを詳細に表示
      const contentType = response.headers.get('content-type')
      let errorMessage = '採点に失敗しました'

      try {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } else {
          const errorText = await response.text()
          errorMessage = errorText || `HTTPエラー: ${response.status} ${response.statusText}`
        }
      } catch (parseError) {
        errorMessage = `HTTPエラー: ${response.status} ${response.statusText}`
      }

      throw new Error(errorMessage)
    }

    // レスポンスボディが空でないか確認
    const responseText = await response.text()
    if (!responseText || responseText.trim() === '') {
      throw new Error('サーバーから空のレスポンスが返されました')
    }

    // JSONをパース
    try {
      const result = JSON.parse(responseText)
      console.log('採点結果を受信:', result)
      return result
    } catch (parseError) {
      console.error('JSONパースエラー:', parseError)
      console.error('レスポンステキスト:', responseText.substring(0, 500))
      throw new Error('サーバーからの応答を解析できませんでした: ' + (parseError instanceof Error ? parseError.message : String(parseError)))
    }
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}
