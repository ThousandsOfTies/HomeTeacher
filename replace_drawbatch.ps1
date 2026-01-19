$ErrorActionPreference = 'Stop'

# Read the entire file
$filePath = "repos\drawing-common\src\hooks\useDrawing.ts"
$content = Get-Content $filePath -Raw

# Define the old drawBatch function (lines 213-241)
$oldFunction = @'
    const ctx = ctxRef.current
    const path = currentPathRef.current

    // 正規化座標に変換
    const normalizedPoints = points.map(p => ({
      x: p.x / canvas.width,
      y: p.y / canvas.height
    }))

    // バージョン識別用ログ (Strict Option 2)
    if (Math.random() < 0.01) console.log('useDrawing v0.2.14.l64 - Strict Option 2 (No Connect)')

    // ユーザー指示「2番だけにしてください」に従い、
    // 1. ベジェ曲線復活 -> なし（LineTo）
    // 2. バッチ間の接続廃止 -> あり（moveToなし）
    // 3. フィルタ -> なし

    ctx.beginPath()

    // 前の点への moveTo を行わない (バッチ間を接続しない)
    // 今回のバッチの点だけで線を描く
    
    for (const point of normalizedPoints) {
      path.points.push(point)
      ctx.lineTo(point.x * canvas.width, point.y * canvas.height)
    }

    ctx.stroke()
  }
'@

# Define the new drawBatch function with smart stroke separation
$newFunction = @'
    const ctx = ctxRef.current
    const path = currentPathRef.current

    // 正規化座標に変換
    const normalizedPoints = points.map(p => ({
      x: p.x / canvas.width,
      y: p.y / canvas.height
    }))

    // バージョン識別用ログ
    if (Math.random() < 0.01) console.log('useDrawing v0.2.14.l68 - Smart Stroke Separation')

    // 異常な飛び値（＝ストローク区切りの欠落）を検出
    // 閾値: 画面対角線の 5% 程度の二乗
    const threshold = 0.05
    const thresholdSq = threshold * threshold
    
    // 前回の最後の点（基準点）
    const prevPoints = path.points
    let lastPt = prevPoints.length > 0 ? prevPoints[prevPoints.length - 1] : normalizedPoints[0]
    
    // バッチ内の各点を処理
    for (let i = 0; i < normalizedPoints.length; i++) {
      const point = normalizedPoints[i]
      
      // 距離チェック（ストローク区切り検出）
      if (prevPoints.length > 0 || i > 0) {
        const dx = point.x - lastPt.x
        const dy = point.y - lastPt.y
        const distSq = dx * dx + dy * dy
        
        if (distSq > thresholdSq) {
          // 大きなジャンプを検出 = 新しいストローク開始
          console.log('[HomeTeacher] New stroke detected at jump:', { from: lastPt, to: point })
          
          // 現在のパスを確定
          if (path.points.length > 0 && options.onPathComplete) {
            options.onPathComplete(path)
          }
          
          // 新しいパスを開始（色・幅などは継承）
          const newPath: DrawingPath = {
            points: [point],
            color: path.color,
            width: path.width,
            isEraser: path.isEraser,
            tool: path.tool
          }
          currentPathRef.current = newPath
          
          // 次の点の処理用に更新
          lastPt = point
          continue
        }
      }
      
      // 通常処理: 点を追加してベジェ曲線で描画
      path.points.push(point)
      const points = path.points
      const len = points.length

      if (len < 2) {
        lastPt = point
        continue
      }

      // ベジェ曲線描画ロジック
      if (len === 2) {
        // 2点の場合は直線
        ctx.beginPath()
        ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height)
        ctx. lineTo(points[1].x * canvas.width, points[1].y * canvas.height)
        ctx.stroke()
      } else {
        // 3点以上: 二次ベジェ曲線
        const p0 = points[len - 3]
        const p1 = points[len - 2]
        const p2 = points[len - 1]

        const cpX = p1.x * canvas.width
        const cpY = p1.y * canvas.height
        const endX = (p1.x + p2.x) / 2 * canvas.width
        const endY = (p1.y + p2.y) / 2 * canvas.height

        ctx.beginPath()
        if (len === 3) {
          ctx.moveTo(p0.x * canvas.width, p0.y * canvas.height)
        } else {
          const prevEndX = (p0.x + p1.x) / 2 * canvas.width
          const prevEndY = (p0.y + p1.y) / 2 * canvas.height
          ctx.moveTo(prevEndX, prevEndY)
        }
        ctx.quadraticCurveTo(cpX, cpY, endX, endY)
        ctx.stroke()
      }
      
      lastPt = point
    }
  }
'@

# Replace the function
$newContent = $content.Replace($oldFunction, $newFunction)

if ($content -eq $newContent) {
    Write-Error "Replacement failed - pattern not found in file"
    exit 1
}

# Write back to file
Set-Content $filePath -Value $newContent -NoNewline

Write-Host "drawBatch function successfully replaced with smart stroke separation logic"
