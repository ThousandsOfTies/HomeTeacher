import { useState, useEffect } from 'react'

export const useZoomPan = (containerRef: React.RefObject<HTMLDivElement>) => {
  const [scale, setScale] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

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
  const resetZoom = (pdfDoc: any, pageNum: number, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    if (!pdfDoc || !containerRef.current || !canvasRef.current) return

    pdfDoc.getPage(pageNum).then((page: any) => {
      const viewport = page.getViewport({ scale: 1 })
      const container = containerRef.current!

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const scaleX = containerWidth / viewport.width
      const scaleY = containerHeight / viewport.height
      const fitScale = Math.min(scaleX, scaleY)

      setScale(fitScale)
      setPanOffset({ x: 0, y: 0 })
    })
  }

  // Ctrl+ホイールでズーム
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          const delta = e.deltaY > 0 ? -0.1 : 0.1
          setScale(prev => Math.max(0.5, Math.min(5, prev + delta)))
        }
      }
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef])

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
    scale,
    setScale,
    isPanning,
    panOffset,
    setPanOffset,
    isCtrlPressed,
    startPanning,
    doPanning,
    stopPanning,
    resetZoom
  }
}
