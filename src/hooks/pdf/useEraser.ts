import { useState } from 'react'
import { DrawingPath } from './useDrawing'

export const useEraser = (
  pageNum: number,
  drawingPaths: Map<number, DrawingPath[]>,
  setDrawingPaths: React.Dispatch<React.SetStateAction<Map<number, DrawingPath[]>>>,
  eraserSize: number
) => {
  const [isErasing, setIsErasing] = useState(false)

  const startErasing = () => {
    setIsErasing(true)
  }

  const eraseAtPosition = (canvas: HTMLCanvasElement, x: number, y: number) => {
    // 正規化座標で計算
    const normalizedX = x / canvas.width
    const normalizedY = y / canvas.height

    const currentPaths = drawingPaths.get(pageNum) || []

    // クリックした位置に近いパスを探す
    const eraserRadiusPx = eraserSize
    let targetPathIndex = -1
    let targetPointIndex = -1
    let minDistance = Infinity

    for (let i = currentPaths.length - 1; i >= 0; i--) {
      const path = currentPaths[i]
      for (let j = 0; j < path.points.length; j++) {
        const point = path.points[j]
        // 正規化座標をピクセル座標に変換して距離を計算
        const pointXPx = point.x * canvas.width
        const pointYPx = point.y * canvas.height

        const distance = Math.sqrt(
          Math.pow(pointXPx - x, 2) + Math.pow(pointYPx - y, 2)
        )

        if (distance < eraserRadiusPx && distance < minDistance) {
          targetPathIndex = i
          targetPointIndex = j
          minDistance = distance
        }
      }
    }

    if (targetPathIndex !== -1 && targetPointIndex !== -1) {
      const path = currentPaths[targetPathIndex]

      // パスを分裂させる
      if (path.points.length > 3) {
        const beforePoints = path.points.slice(0, targetPointIndex)
        const afterPoints = path.points.slice(targetPointIndex + 1)

        setDrawingPaths(prev => {
          const newMap = new Map(prev)
          const newPaths = [...currentPaths]

          // 元のパスを削除
          newPaths.splice(targetPathIndex, 1)

          // 分裂した2つのパスを追加（2点以上の場合のみ）
          if (beforePoints.length >= 2) {
            newPaths.push({
              points: beforePoints,
              color: path.color,
              width: path.width
            })
          }
          if (afterPoints.length >= 2) {
            newPaths.push({
              points: afterPoints,
              color: path.color,
              width: path.width
            })
          }

          if (newPaths.length === 0) {
            newMap.delete(pageNum)
          } else {
            newMap.set(pageNum, newPaths)
          }
          return newMap
        })
      } else {
        // パスが短い場合は削除
        setDrawingPaths(prev => {
          const newMap = new Map(prev)
          const newPaths = [...currentPaths]
          newPaths.splice(targetPathIndex, 1)
          if (newPaths.length === 0) {
            newMap.delete(pageNum)
          } else {
            newMap.set(pageNum, newPaths)
          }
          return newMap
        })
      }
    }
  }

  const stopErasing = (onSave?: (paths: DrawingPath[]) => void) => {
    if (isErasing) {
      // 消しゴム終了時に履歴を保存
      const currentPaths = drawingPaths.get(pageNum) || []
      if (onSave) {
        onSave(currentPaths)
      }
    }
    setIsErasing(false)
  }

  return {
    isErasing,
    startErasing,
    eraseAtPosition,
    stopErasing
  }
}
