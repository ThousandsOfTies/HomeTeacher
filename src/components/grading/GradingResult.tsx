import { GradingResult as GradingResultType } from '../../services/api'
import { SNSLinkRecord } from '../../utils/indexedDB'
import './GradingResult.css'
import * as SimpleIcons from 'simple-icons'

interface GradingResultProps {
  result: GradingResultType | null
  onClose: () => void
  snsLinks?: SNSLinkRecord[]
  timeLimitMinutes?: number // SNS利用時間制限（分）
}

// SNS名からSimple Iconsのアイコンを取得
const getSNSIcon = (name: string): { svg: string; color: string } | null => {
  // 名前を正規化（小文字化、スペース除去）
  const normalizedName = name.toLowerCase().replace(/\s+/g, '')

  // よく使われるSNSのマッピング
  const iconMap: Record<string, string> = {
    'x': 'siX',
    'twitter': 'siX',
    'x(twitter)': 'siX',  // 'X (Twitter)' の正規化形
    'youtube': 'siYoutube',
    'instagram': 'siInstagram',
    'facebook': 'siFacebook',
    'tiktok': 'siTiktok',
    'github': 'siGithub',
    'discord': 'siDiscord',
    'twitch': 'siTwitch',
    'linkedin': 'siLinkedin',
    'reddit': 'siReddit',
    'note': 'siNote',
    'line': 'siLine',
    'zenn': 'siZenn',
    'qiita': 'siQiita',
    'amazon': 'siAmazon',
    'niconico': 'siNiconico',
    'pixiv': 'siPixiv'
  }

  const iconKey = iconMap[normalizedName]
  if (iconKey && iconKey in SimpleIcons) {
    const icon = SimpleIcons[iconKey as keyof typeof SimpleIcons] as SimpleIcons.SimpleIcon
    return {
      svg: icon.svg,
      color: `#${icon.hex}`
    }
  }

  return null
}

const GradingResult = ({ result, onClose, snsLinks = [], timeLimitMinutes = 30 }: GradingResultProps) => {
  if (!result) return null

  // Null要素をフィルタリングした有効な問題のみを取得
  const validProblems = result.problems?.filter(problem =>
    problem.problemNumber !== null && problem.isCorrect !== null
  ) || []

  // SNS選択画面（警告ページ）を開く
  const openSNSSelectionPage = () => {
    // SNSリンク情報をJSON形式でURLパラメータに渡す
    const snsLinksJson = JSON.stringify(snsLinks.map(link => ({
      id: link.id,
      name: link.name,
      url: link.url.startsWith('http://') || link.url.startsWith('https://') ? link.url : 'https://' + link.url,
      icon: link.icon
    })))

    // 警告ページへ遷移（SNS選択UIを表示）
    const warningUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}warning.html?time=${timeLimitMinutes}&snsLinks=${encodeURIComponent(snsLinksJson)}`

    // 現在のタブを警告ページに置き換え
    window.location.replace(warningUrl)
  }

  return (
    <div className="grading-result-overlay">
      <div className="grading-result-panel">
        <div className="result-header">
          <h2>採点結果</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="result-content">
          {validProblems.length > 0 ? (
            <div className="problems-list">
              {validProblems.map((problem, index) => (
                <div
                  key={index}
                  className={`problem-item ${
                    problem.isCorrect ? 'correct' : 'incorrect'
                  }`}
                >
                  <div className="problem-header">
                    <span className="result-icon">
                      {problem.isCorrect ? '⭕' : '❌'}
                    </span>
                    <h3>
                      {problem.problemNumber || `問題 ${index + 1}`}
                    </h3>
                  </div>

                  {problem.problemText && (
                    <div className="problem-text">
                      {problem.problemText}
                    </div>
                  )}

                  {problem.studentAnswer && (
                    <div className="student-answer">
                      <strong>あなたの解答:</strong> {problem.studentAnswer}
                    </div>
                  )}

                  {!problem.isCorrect && problem.correctAnswer && (
                    <div className="correct-answer">
                      <strong>正しい解答:</strong> {problem.correctAnswer}
                    </div>
                  )}

                  {problem.feedback && (
                    <div className="feedback">
                      <strong>フィードバック:</strong>
                      <p>{problem.feedback}</p>
                    </div>
                  )}

                  {problem.explanation && (
                    <div className="explanation">
                      <strong>解説:</strong>
                      <p>{problem.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="raw-response">
              <p>{result.overallComment || result.rawResponse}</p>
            </div>
          )}

          {result.overallComment && validProblems.length > 0 && (
            <div className="overall-comment">
              <h3>全体コメント</h3>
              <p>{result.overallComment}</p>
            </div>
          )}
        </div>

        {snsLinks.length > 0 && (
          <div className="sns-links-section">
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '12px', textAlign: 'center' }}>
              Enjoy!
            </h3>
            <button
              onClick={openSNSSelectionPage}
              style={{
                width: '100%',
                padding: '20px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              📱 SNSを見る
            </button>
          </div>
        )}

        <div className="result-footer">
          <button className="close-button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

export default GradingResult
