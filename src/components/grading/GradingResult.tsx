import { GradingResult as GradingResultType } from '../../services/api'
import { SNSLinkRecord } from '../../utils/indexedDB'
import './GradingResult.css'
import * as SimpleIcons from 'simple-icons'

interface GradingResultProps {
  result: GradingResultType | null
  onClose: () => void
  snsLinks?: SNSLinkRecord[]
}

// SNS名からSimple Iconsのアイコンを取得
const getSNSIcon = (name: string): { svg: string; color: string } | null => {
  // 名前を正規化（小文字化、スペース除去）
  const normalizedName = name.toLowerCase().replace(/\s+/g, '')

  // よく使われるSNSのマッピング
  const iconMap: Record<string, string> = {
    'x': 'siX',
    'twitter': 'siX',
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

const GradingResult = ({ result, onClose, snsLinks = [] }: GradingResultProps) => {
  if (!result) return null

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
          {result.problems && result.problems.length > 0 ? (
            <div className="problems-list">
              {result.problems.map((problem, index) => (
                <div
                  key={index}
                  className={`problem-item ${
                    problem.isCorrect ? 'correct' : 'incorrect'
                  }`}
                >
                  <div className="problem-header">
                    <h3>
                      {problem.problemNumber || `問題 ${index + 1}`}
                    </h3>
                    <span className="result-badge">
                      {problem.isCorrect ? '✓ 正解' : '✗ 不正解'}
                    </span>
                  </div>

                  {problem.problemText && (
                    <div className="problem-text">
                      <strong>問題:</strong> {problem.problemText}
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

          {result.overallComment && result.problems.length > 0 && (
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
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {snsLinks.map((link) => {
                // URLが相対URLの場合は絶対URLに変換
                let fullUrl = link.url
                if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                  fullUrl = 'https://' + link.url
                }

                // SNSアイコンを取得
                const snsIcon = getSNSIcon(link.name)
                const iconColor = snsIcon?.color || '#3498db'

                return (
                  <a
                    key={link.id}
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px 20px',
                      backgroundColor: 'white',
                      border: `2px solid ${iconColor}`,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#2c3e50',
                      textDecoration: 'none',
                      minWidth: '100px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = iconColor
                      e.currentTarget.style.color = 'white'
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = `0 6px 20px ${iconColor}40`
                      // SVGアイコンの色を白に変更
                      const svg = e.currentTarget.querySelector('svg')
                      if (svg) svg.style.fill = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.color = '#2c3e50'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                      // SVGアイコンの色を元に戻す
                      const svg = e.currentTarget.querySelector('svg')
                      if (svg) svg.style.fill = iconColor
                    }}
                    title={fullUrl}
                  >
                    {snsIcon ? (
                      <div
                        style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        dangerouslySetInnerHTML={{ __html: snsIcon.svg }}
                      />
                    ) : (
                      <span style={{ fontSize: '40px' }}>{link.icon}</span>
                    )}
                    <span>{link.name}</span>
                  </a>
                )
              })}
            </div>
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
