import { useState, useEffect } from 'react'

export const useZoomPan = (
  containerRef: React.RefObject<HTMLDivElement>,
  renderScale: number = 5.0
) => {
  // プリレンダリング戦略: 初期zoom = 1/RENDER_SCALE（等倍表示）
  const [zoom, setZoom] = useState(1.0 / renderScale)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [lastWheelCursor, setLastWheelCursor] = useState<{ x: number; y: number } | null>(null)

  // パン（移動）機能 - Ctrl+ドラッグで移動
  const startPanning = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return

    e.preventDefault()
    setIsPanning(true)
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const doPanning = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return

    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    })
  }

  const stopPanning = () => {
    setIsPanning(false)
  }

  // ズーム機能
  const resetZoom = () => {
    // プリレンダリング: リセットは等倍表示（1/RENDER_SCALE）に戻す
    setZoom(1.0 / renderScale)
    setPanOffset({ x: 0, y: 0 })
  }

  // Ctrl+ホイールでズーム（マウスカーソルを中心に）
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // containerRef内でのホイールイベントのみ処理
      if (!containerRef.current) return
      
      const target = e.target as Node
      if (!containerRef.current.contains(target)) return
      
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()

        const delta = e.deltaY > 0 ? -0.1 : 0.1
        const oldZoom = zoom
        // プリレンダリング: zoom範囲 1/RENDER_SCALE ～ 1.0
        const newZoom = Math.max(1.0 / renderScale, Math.min(1.0, oldZoom + delta))

        // マウスカーソルを中心にズームするため、パンオフセットを調整
        const containerRect = containerRef.current.getBoundingClientRect()

        // マウスカーソルのコンテナ内での位置（ビューポート座標 - コンテナのビューポート座標）
        const cursorX = e.clientX - containerRect.left
        const cursorY = e.clientY - containerRect.top
        
        // 最後のホイールイベントのマウス位置を保存（ビューポート座標で保存）
        setLastWheelCursor({ x: e.clientX, y: e.clientY })

        // カーソルが指すPDFピクセルを計算
        const pdfPixelX = (cursorX - panOffset.x) / zoom
        const pdfPixelY = (cursorY - panOffset.y) / zoom
        
        console.log('🖱️ ホイールズーム:', {
          clientX: e.clientX,
          clientY: e.clientY,
          containerLeft: containerRect.left,
          containerTop: containerRect.top,
          cursorX,
          cursorY,
          oldZoom,
          newZoom,
          oldPanOffset: { ...panOffset },
          scaleRatio: newZoom / oldZoom,
          pdfPixel: `(${pdfPixelX.toFixed(1)}, ${pdfPixelY.toFixed(1)})`
        })

        // 現在のpanOffsetを考慮した、カーソルが指しているコンテンツ座標
        // contentX = (cursorX - panOffset.x) / oldZoom
        // ズーム後も同じコンテンツ座標がcursorXに来るように調整
        // cursorX = contentX * newZoom + newPanOffset
        // newPanOffset = cursorX - contentX * newZoom
        //              = cursorX - (cursorX - oldPanOffset) * (newZoom / oldZoom)
        const scaleRatio = newZoom / oldZoom
        const newPanOffsetX = cursorX - (cursorX - panOffset.x) * scaleRatio
        const newPanOffsetY = cursorY - (cursorY - panOffset.y) * scaleRatio
        
        // 検証：新しいpanOffsetで同じPDFピクセルを指すか確認
        const verifyPdfPixelX = (cursorX - newPanOffsetX) / newZoom
        const verifyPdfPixelY = (cursorY - newPanOffsetY) / newZoom

        console.log('📍 新しいpanOffset:', {
          newPanOffsetX,
          newPanOffsetY,
          calculation: {
            cursorX,
            cursorY,
            'cursorX - panOffset.x': cursorX - panOffset.x,
            'cursorY - panOffset.y': cursorY - panOffset.y,
            scaleRatio,
            '(cursorX - panOffset.x) * scaleRatio': (cursorX - panOffset.x) * scaleRatio,
            '(cursorY - panOffset.y) * scaleRatio': (cursorY - panOffset.y) * scaleRatio
          },
          verify: `PDF pixel still (${verifyPdfPixelX.toFixed(1)}, ${verifyPdfPixelY.toFixed(1)}) - should match (${pdfPixelX.toFixed(1)}, ${pdfPixelY.toFixed(1)})`
        })

        setZoom(newZoom)
        const newOffset = {
          x: newPanOffsetX,
          y: newPanOffsetY
        }
        setPanOffset(newOffset)
      }
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, zoom, panOffset])

  // Ctrlキーの状態を追跡
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return {
    zoom,
    setZoom,
    isPanning,
    panOffset,
    setPanOffset,
    isCtrlPressed,
    startPanning,
    doPanning,
    stopPanning,
    resetZoom,
    lastWheelCursor
  }
}
