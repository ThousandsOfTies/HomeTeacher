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

    currentPathRef.current.points.push({ x: normalizedX, y: normalizedY })

    // リアルタイムで描画
    const ctx = canvas.getContext('2d')!
    const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 2]

    ctx.strokeStyle = currentPathRef.current.color
    ctx.lineWidth = currentPathRef.current.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(prevPoint.x * canvas.width, prevPoint.y * canvas.height)
    ctx.lineTo(x, y)
    ctx.stroke()
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

      ctx.beginPath()
      ctx.strokeStyle = path.color
      ctx.lineWidth = path.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 正規化座標(0-1)を実座標に変換
      ctx.moveTo(path.points[0].x * width, path.points[0].y * height)
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * width, path.points[i].y * height)
      }
      ctx.stroke()
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
