import { useState, useEffect } from 'react'

export const useZoomPan = (
  containerRef: React.RefObject<HTMLDivElement>,
  renderScale: number = 5.0,
  minFitZoom: number = 1.0 / 5.0,
  onResetToFit?: () => void,
  canvasRef?: React.RefObject<HTMLCanvasElement>
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

  // パン範囲制限を適用する関数（常に2/3が表示されるように）
  const applyPanLimit = (offset: { x: number; y: number }, currentZoom?: number): { x: number; y: number } => {
    if (!containerRef.current || !canvasRef?.current) {
      return offset
    }

    const container = containerRef.current
    const canvas = canvasRef.current

    // PDFの表示サイズ（ズーム適用後）
    const zoomValue = currentZoom ?? zoom
    const displayWidth = canvas.width * zoomValue
    const displayHeight = canvas.height * zoomValue

    // コンテナのサイズ
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // 表示されているPDFの部分が常に2/3以上になるように制限
    // PDFが画面より大きい場合のみ制限を適用
    let limitedX = offset.x
    let limitedY = offset.y

    if (displayWidth > containerWidth) {
      // X方向の制限: PDFの左端1/3まで隠れる、右端1/3まで隠れる
      const minX = -displayWidth / 3  // PDFが左にパンした時の最小値
      const maxX = containerWidth - displayWidth * (2 / 3)  // PDFが右にパンした時の最大値
      limitedX = Math.max(minX, Math.min(maxX, offset.x))
    }

    if (displayHeight > containerHeight) {
      // Y方向の制限: PDFの上端1/3まで隠れる、下端1/3まで隠れる
      const minY = -displayHeight / 3  // PDFが上にパンした時の最小値
      const maxY = containerHeight - displayHeight * (2 / 3)  // PDFが下にパンした時の最大値
      limitedY = Math.max(minY, Math.min(maxY, offset.y))
    }

    return { x: limitedX, y: limitedY }
  }

  const doPanning = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return

    const newOffset = {
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    }

    // パン範囲制限を適用
    const limitedOffset = applyPanLimit(newOffset)
    setPanOffset(limitedOffset)
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
        // プリレンダリング: zoom範囲 minFitZoom ～ 1.0
        let newZoom = Math.min(1.0, oldZoom + delta)

        // フィットサイズより小さくしようとしたら、フィット表示に戻す
        if (newZoom < minFitZoom) {
          if (onResetToFit) {
            onResetToFit()
            return
          } else {
            newZoom = minFitZoom
          }
        }

        // マウスカーソルを中心にズームするため、パンオフセットを調整
        const containerRect = containerRef.current.getBoundingClientRect()

        // マウスカーソルのコンテナ内での位置（ビューポート座標 - コンテナのビューポート座標）
        const cursorX = e.clientX - containerRect.left
        const cursorY = e.clientY - containerRect.top
        
        // 最後のホイールイベントのマウス位置を保存（ビューポート座標で保存）
        setLastWheelCursor({ x: e.clientX, y: e.clientY })

        // 現在のpanOffsetを考慮した、カーソルが指しているコンテンツ座標
        // contentX = (cursorX - panOffset.x) / oldZoom
        // ズーム後も同じコンテンツ座標がcursorXに来るように調整
        // cursorX = contentX * newZoom + newPanOffset
        // newPanOffset = cursorX - contentX * newZoom
        //              = cursorX - (cursorX - oldPanOffset) * (newZoom / oldZoom)
        const scaleRatio = newZoom / oldZoom
        const newPanOffsetX = cursorX - (cursorX - panOffset.x) * scaleRatio
        const newPanOffsetY = cursorY - (cursorY - panOffset.y) * scaleRatio

        setZoom(newZoom)
        const newOffset = {
          x: newPanOffsetX,
          y: newPanOffsetY
        }
        // パン範囲制限を適用してからセット（新しいズーム値を使用）
        const limitedOffset = applyPanLimit(newOffset, newZoom)
        setPanOffset(limitedOffset)
      }
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, zoom, panOffset, minFitZoom, onResetToFit])

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
    lastWheelCursor,
    applyPanLimit
  }
}
