import { useRef, useState } from 'react'

// 描画パスの型定義
export type DrawingPath = {
  points: { x: number; y: number }[]
  color: string
  width: number
}

export const useDrawing = (pageNum: number) => {
  const [drawingPaths, setDrawingPaths] = useState<Map<number, DrawingPath[]>>(new Map())
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false)
  const currentPathRef = useRef<DrawingPath | null>(null)

  const startDrawing = (canvas: HTMLCanvasElement, x: number, y: number, color: string, width: number) => {
    setIsCurrentlyDrawing(true)

    // 正規化座標で保存（0-1の範囲）
    const normalizedX = x / canvas.width
    const normalizedY = y / canvas.height

    currentPathRef.current = {
      points: [{ x: normalizedX, y: normalizedY }],
      color,
      width
    }
  }

  const continueDrawing = (canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!isCurrentlyDrawing || !currentPathRef.current) return

    const normalizedX = x / canvas.width
    const normalizedY = y / canvas.height

    // すべての点を保存（間引きなし - Apple Pencilの高速描画に対応）
    currentPathRef.current.points.push({ x: normalizedX, y: normalizedY })

    const points = currentPathRef.current.points
    if (points.length < 2) return

    // 二次ベジェ曲線で滑らかに描画
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = currentPathRef.current.color
    ctx.lineWidth = currentPathRef.current.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const len = points.length
    if (len < 3) {
      // 点が2つの場合は直線
      ctx.beginPath()
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height)
      ctx.lineTo(points[1].x * canvas.width, points[1].y * canvas.height)
      ctx.stroke()
    } else {
      // 3点以上の場合はベジェ曲線で滑らかに
      const p0 = points[len - 3]
      const p1 = points[len - 2]
      const p2 = points[len - 1]

      // 制御点を中間点に設定
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
  }

  const stopDrawing = (onSave?: (paths: DrawingPath[]) => void) => {
    if (isCurrentlyDrawing && currentPathRef.current) {
      const newPath = currentPathRef.current
      setDrawingPaths(prev => {
        const newMap = new Map(prev)
        const currentPaths = newMap.get(pageNum) || []
        const newPaths = [...currentPaths, newPath]
        newMap.set(pageNum, newPaths)

        // 履歴に保存
        if (onSave) {
          onSave(newPaths)
        }

        return newMap
      })

      currentPathRef.current = null
      setIsCurrentlyDrawing(false)
    }
  }

  const clearDrawing = () => {
    setDrawingPaths(prev => {
      const newMap = new Map(prev)
      newMap.delete(pageNum)
      return newMap
    })
  }

  const clearAllDrawings = () => {
    setDrawingPaths(new Map())
  }

  // ペン跡を再描画する関数（正規化座標から実座標に変換）
  const redrawPaths = (ctx: CanvasRenderingContext2D, paths: DrawingPath[]) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const width = ctx.canvas.width
    const height = ctx.canvas.height

    paths.forEach(path => {
      if (path.points.length < 2) return

      ctx.strokeStyle = path.color
      ctx.lineWidth = path.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const points = path.points

      if (points.length === 2) {
        // 2点の場合は直線
        ctx.beginPath()
        ctx.moveTo(points[0].x * width, points[0].y * height)
        ctx.lineTo(points[1].x * width, points[1].y * height)
        ctx.stroke()
      } else {
        // 3点以上の場合はベジェ曲線で滑らかに描画
        ctx.beginPath()
        ctx.moveTo(points[0].x * width, points[0].y * height)

        for (let i = 1; i < points.length - 1; i++) {
          const p0 = points[i]
          const p1 = points[i + 1]

          // 制御点を現在の点に、終点を中間点に設定
          const cpX = p0.x * width
          const cpY = p0.y * height
          const endX = (p0.x + p1.x) / 2 * width
          const endY = (p0.y + p1.y) / 2 * height

          ctx.quadraticCurveTo(cpX, cpY, endX, endY)
        }

        // 最後の点まで直線で接続
        const lastPoint = points[points.length - 1]
        ctx.lineTo(lastPoint.x * width, lastPoint.y * height)
        ctx.stroke()
      }
    })
  }

  return {
    drawingPaths,
    setDrawingPaths,
    isCurrentlyDrawing,
    startDrawing,
    continueDrawing,
    stopDrawing,
    clearDrawing,
    clearAllDrawings,
    redrawPaths
  }
}
