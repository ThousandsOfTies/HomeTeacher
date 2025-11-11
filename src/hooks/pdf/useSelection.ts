import { useState } from 'react'

// 矩形選択の型定義
export type SelectionRect = {
  startX: number
  startY: number
  endX: number
  endY: number
} | null

export const useSelection = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const [selectionPreview, setSelectionPreview] = useState<string | null>(null)

  const startSelection = (canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!isSelectionMode) return

    setIsSelecting(true)
    setSelectionRect({
      startX: x,
      startY: y,
      endX: x,
      endY: y
    })
  }

  const updateSelection = (
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ) => {
    if (!isSelecting || !isSelectionMode || !selectionRect) return

    setSelectionRect({
      ...selectionRect,
      endX: x,
      endY: y
    })

    // 選択範囲を描画
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const width = x - selectionRect.startX
    const height = y - selectionRect.startY

    // 選択範囲の枠を描画
    ctx.strokeStyle = '#2196F3'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(selectionRect.startX, selectionRect.startY, width, height)

    // 選択範囲の背景を半透明にする
    ctx.fillStyle = 'rgba(33, 150, 243, 0.1)'
    ctx.fillRect(selectionRect.startX, selectionRect.startY, width, height)
  }

  const finishSelection = (
    pdfCanvas: HTMLCanvasElement,
    drawingCanvas: HTMLCanvasElement
  ) => {
    if (isSelecting && selectionRect) {
      setIsSelecting(false)

      const { startX, startY, endX, endY } = selectionRect
      const x = Math.min(startX, endX)
      const y = Math.min(startY, endY)
      const width = Math.abs(endX - startX)
      const height = Math.abs(endY - startY)

      if (width >= 50 && height >= 50) {
        // 選択範囲を切り出してプレビュー画像を作成
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = width
        tempCanvas.height = height
        const ctx = tempCanvas.getContext('2d')!

        // PDFを描画
        ctx.drawImage(pdfCanvas, x, y, width, height, 0, 0, width, height)

        // 手書きを重ねる
        ctx.drawImage(drawingCanvas, x, y, width, height, 0, 0, width, height)

        // Base64画像として保存
        const previewData = tempCanvas.toDataURL('image/jpeg', 0.85)
        setSelectionPreview(previewData)
      }
    }
  }

  const cancelSelection = () => {
    setIsSelectionMode(false)
    setSelectionRect(null)
    setSelectionPreview(null)
  }

  return {
    isSelectionMode,
    setIsSelectionMode,
    isSelecting,
    selectionRect,
    setSelectionRect,
    selectionPreview,
    setSelectionPreview,
    startSelection,
    updateSelection,
    finishSelection,
    cancelSelection
  }
}
