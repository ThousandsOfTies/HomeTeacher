import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { gradeWork, GradingResult as GradingResultType } from '../services/api'
import GradingResult from './grading/GradingResult'
import { savePDFRecord, getPDFRecord, getAllSNSLinks, SNSLinkRecord, PDFFileRecord, saveGradingHistory, generateGradingHistoryId } from '../utils/indexedDB'
import './PDFViewer.css'

// PDF.jsのworkerを設定（CDNから読み込み）
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface PDFViewerProps {
  pdfRecord: PDFFileRecord // PDFファイルレコード全体を受け取る
  pdfId: string // IndexedDBのレコードID
  onBack?: () => void // 管理画面に戻るコールバック
}

// 描画パスの型定義
type DrawingPath = {
  points: { x: number; y: number }[]
  color: string
  width: number
}

// 矩形選択の型定義
type SelectionRect = {
  startX: number
  startY: number
  endX: number
  endY: number
} | null

// アイコンSVGの定義
const ICON_SVG = {
  // ペンアイコン（ボタン用）
  pen: (isActive: boolean, color: string) => (
    <svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24'>
      <path fill={isActive ? 'white' : color} d='M3,17.25V21h3.75L17.81,9.94l-3.75-3.75L3,17.25z M20.71,7.04c0.39-0.39,0.39-1.02,0-1.41l-2.34-2.34 c-0.39-0.39-1.02-0.39-1.41,0l-1.83,1.83l3.75,3.75L20.71,7.04z'/>
    </svg>
  ),
  // 消しゴムアイコン（ボタン用）
  eraser: (isActive: boolean) => (
    <svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24'>
      <rect fill={isActive ? 'white' : '#2196F3'} x='5' y='3' width='14' height='14' rx='1'/>
      <rect fill={isActive ? '#4CAF50' : 'white'} stroke={isActive ? 'white' : '#666'} strokeWidth='1' x='6' y='17' width='12' height='4' rx='0.5'/>
      <line stroke={isActive ? 'white' : '#1976D2'} strokeWidth='0.5' x1='7' y1='10' x2='17' y2='10'/>
    </svg>
  ),
  // ペンカーソル（Data URL用）
  penCursor: (color: string) => {
    // # を %23 にエンコード
    const encodedColor = color.replace('#', '%23')
    return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='${encodedColor}' d='M3,17.25V21h3.75L17.81,9.94l-3.75-3.75L3,17.25z M20.71,7.04c0.39-0.39,0.39-1.02,0-1.41l-2.34-2.34 c-0.39-0.39-1.02-0.39-1.41,0l-1.83,1.83l3.75,3.75L20.71,7.04z'/></svg>") 2 20, crosshair`
  },
  // 消しゴムカーソル（Data URL用）
  eraserCursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><rect fill=\'%232196F3\' x=\'5\' y=\'3\' width=\'14\' height=\'14\' rx=\'1\'/><rect fill=\'white\' stroke=\'%23666\' stroke-width=\'1\' x=\'6\' y=\'17\' width=\'12\' height=\'4\' rx=\'0.5\'/><line stroke=\'%231976D2\' stroke-width=\'0.5\' x1=\'7\' y1=\'10\' x2=\'17\' y2=\'10\'/></svg>") 12 12, pointer'
} as const

const PDFViewer = ({ pdfRecord, pdfId, onBack }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [isEraserMode, setIsEraserMode] = useState(false)
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false)
  const [isErasing, setIsErasing] = useState(false)

  // ペンの設定
  const [penColor, setPenColor] = useState('#FF0000')
  const [penSize, setPenSize] = useState(3)
  const [showPenPopup, setShowPenPopup] = useState(false)

  // 消しゴムの設定
  const [eraserSize, setEraserSize] = useState(20)
  const [showEraserPopup, setShowEraserPopup] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGrading, setIsGrading] = useState(false)
  const [gradingResult, setGradingResult] = useState<GradingResultType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gradingError, setGradingError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  // 矩形選択の状態
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const [selectionPreview, setSelectionPreview] = useState<string | null>(null)

  // ステータスバー用のメッセージ
  const [statusMessages, setStatusMessages] = useState<string[]>([])
  const addStatusMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP')
    const fullMessage = `[${timestamp}] ${message}`
    setStatusMessages(prev => [...prev, fullMessage].slice(-20)) // 最新20件のみ保持
    console.log(fullMessage)
  }

  // SNSリンク
  const [snsLinks, setSnsLinks] = useState<SNSLinkRecord[]>([])

  // SNSリンクを読み込む
  useEffect(() => {
    const loadSNSLinks = async () => {
      try {
        const links = await getAllSNSLinks()
        setSnsLinks(links)
      } catch (error) {
        console.error('Failed to load SNS links:', error)
      }
    }
    loadSNSLinks()
  }, [])

  // 描画パスを保存（ページごと）
  const [drawingPaths, setDrawingPaths] = useState<Map<number, DrawingPath[]>>(new Map())
  const currentPathRef = useRef<DrawingPath | null>(null)

  // アンドゥ・リドゥ用の履歴（ページごと）
  const [history, setHistory] = useState<Map<number, DrawingPath[][]>>(new Map())
  const [historyIndex, setHistoryIndex] = useState<Map<number, number>>(new Map())

  // ペン跡が変更されたら自動保存（デバウンス付き）
  useEffect(() => {
    if (!pdfId) {
      console.log('⚠️ pdfIdが未設定のため保存をスキップ')
      return
    }

    console.log('📝 ペン跡変更を検知、1秒後に保存予定...', {
      ページ数: drawingPaths.size,
      pdfId
    })

    const timer = setTimeout(async () => {
      addStatusMessage('💾 保存中...')
      try {
        // IndexedDBに各ページのペン跡を保存
        const record = await getPDFRecord(pdfId)
        if (record) {
          // 各ページのdrawingPathsをJSON文字列に変換
          drawingPaths.forEach((paths, pageNumber) => {
            record.drawings[pageNumber] = JSON.stringify(paths)
          })
          // 最終閲覧日時を更新
          record.lastOpened = Date.now()
          await savePDFRecord(record)
          addStatusMessage(`✅ ペン跡を保存しました (${drawingPaths.size}ページ)`)
        }
      } catch (error) {
        addStatusMessage(`❌ 保存失敗: ${error}`)
      }
    }, 1000) // 1秒後に保存（頻繁な保存を避けるため）

    return () => clearTimeout(timer)
  }, [drawingPaths, pdfId])

  // ポップアップの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPenPopup || showEraserPopup) {
        const target = event.target as HTMLElement
        // ポップアップやボタン以外をクリックした場合は閉じる
        if (!target.closest('.tool-popup') && !target.closest('button')) {
          setShowPenPopup(false)
          setShowEraserPopup(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPenPopup, showEraserPopup])

  // PDFを読み込む
  useEffect(() => {
    const loadPDF = async () => {
      setIsLoading(true)
      setError(null)
      try {
        let pdfData: ArrayBuffer | string;

        // Base64データから読み込み（シンプル化）
        if (pdfRecord.fileData) {
          addStatusMessage('💾 PDFを読み込み中...')
          pdfData = `data:application/pdf;base64,${pdfRecord.fileData}`
        } else {
          setError(
            'PDFデータが見つかりません。\n\n' +
            '以下の手順で再度ファイルを追加してください：\n' +
            '1. 管理画面に戻る（🏠ボタン）\n' +
            '2. このPDFを削除\n' +
            '3. PDFを再度追加'
          )
          setIsLoading(false)
          return
        }

        console.log('PDFを読み込み中...')
        const loadingTask = pdfjsLib.getDocument(pdfData)
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setIsLoading(false)
        addStatusMessage(`✅ PDF読み込み成功: ${pdf.numPages}ページ`)

        // 保存されているペン跡を読み込む
        try {
          const record = await getPDFRecord(pdfId)
          if (record && Object.keys(record.drawings).length > 0) {
            const restoredMap = new Map<number, DrawingPath[]>()
            Object.entries(record.drawings).forEach(([pageNumStr, jsonStr]) => {
              const pageNum = parseInt(pageNumStr, 10)
              const paths = JSON.parse(jsonStr) as DrawingPath[]
              restoredMap.set(pageNum, paths)
            })
            setDrawingPaths(restoredMap)
            addStatusMessage(`✅ ペン跡を復元しました (${restoredMap.size}ページ)`)
          } else {
            addStatusMessage('📄 PDFを読み込みました')
          }
        } catch (error) {
          console.error('ペン跡の復元に失敗:', error)
          addStatusMessage('📄 PDFを読み込みました')
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('PDF読み込みエラー:', errorMsg)
        setError('PDFの読み込みに失敗しました: ' + errorMsg)
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfRecord, pdfId])

  // 保存されたパスを再描画する関数（正規化座標から実座標に変換）
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

  // 初回ロード時のフラグ
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const renderTaskRef = useRef<any>(null)

  // ページをレンダリング
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return

    const renderPage = async () => {
      // 前回のレンダリングタスクをキャンセル
      if (renderTaskRef.current) {
        console.log('⚠️ 前回のレンダリングをキャンセル')
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      console.log(`🔄 レンダリング開始: ページ${pageNum}, スケール=${scale}, 初回=${isInitialLoad}`)

      const page = await pdfDoc.getPage(pageNum)

      // 初回ロード時は自動的にフィットするスケールを計算
      let renderScale = scale
      if (isInitialLoad) {
        const viewport = page.getViewport({ scale: 1, rotation: 0 })
        const container = containerRef.current!

        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight

        console.log(`📏 コンテナサイズ: ${containerWidth} x ${containerHeight}`)
        console.log(`📄 PDFサイズ(scale=1): ${viewport.width} x ${viewport.height}`)

        const scaleX = containerWidth / viewport.width
        const scaleY = containerHeight / viewport.height
        const fitScale = Math.min(scaleX, scaleY) * 0.9 // 90%に縮小して余白を確保

        console.log(`🔢 計算したスケール: scaleX=${scaleX.toFixed(2)}, scaleY=${scaleY.toFixed(2)}, fitScale=${fitScale.toFixed(2)}`)

        renderScale = fitScale
        setScale(fitScale)
        setIsInitialLoad(false)
      }

      const viewport = page.getViewport({ scale: renderScale, rotation: 0 })
      console.log(`📐 最終viewport: ${viewport.width} x ${viewport.height}, rotation=${viewport.rotation}`)

      const canvas = canvasRef.current!
      const context = canvas.getContext('2d')!

      canvas.height = viewport.height
      canvas.width = viewport.width

      console.log(`🖼️ キャンバスサイズ設定: ${canvas.width} x ${canvas.height}`)

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      try {
        renderTaskRef.current = page.render(renderContext)
        await renderTaskRef.current.promise
        renderTaskRef.current = null
        console.log(`✅ PDF描画完了: ページ${pageNum}`)
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') {
          console.log('📛 レンダリングがキャンセルされました')
          return
        }
        throw error
      }

      // 描画キャンバスと選択キャンバスのサイズを更新
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.width = viewport.width
        drawingCanvasRef.current.height = viewport.height

        // キャンバスのサイズ変更で内容がクリアされるため、即座にペン跡を再描画
        const currentPaths = drawingPaths.get(pageNum) || []
        if (currentPaths.length > 0) {
          const ctx = drawingCanvasRef.current.getContext('2d')!
          redrawPaths(ctx, currentPaths)
          console.log(`✅ ページ${pageNum}のペン跡を復元しました (${currentPaths.length}本)`)
        }
      }

      if (selectionCanvasRef.current) {
        selectionCanvasRef.current.width = viewport.width
        selectionCanvasRef.current.height = viewport.height
      }
    }

    renderPage()

    // クリーンアップ: コンポーネントのアンマウント時にレンダリングをキャンセル
    return () => {
      if (renderTaskRef.current) {
        console.log('🧹 クリーンアップ: レンダリングをキャンセル')
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNum, scale, isInitialLoad])

  // ペン跡の再描画（PDFレンダリングとは別に管理）
  useEffect(() => {
    if (!drawingCanvasRef.current) return

    const currentPaths = drawingPaths.get(pageNum) || []
    const ctx = drawingCanvasRef.current.getContext('2d')!

    console.log(`🎨 ペン跡を再描画: ページ${pageNum} (${currentPaths.length}本の線)`)
    redrawPaths(ctx, currentPaths)

    if (currentPaths.length > 0) {
      console.log(`✅ ページ${pageNum}のペン跡を復元しました`)
    }
  }, [drawingPaths, pageNum])

  // 描画機能（パスとして保存）
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ctrl押下中は描画しない
    if (e.ctrlKey || e.metaKey) return
    if (!isDrawingMode || !drawingCanvasRef.current) return

    setIsCurrentlyDrawing(true)
    const canvas = drawingCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    // 新しいパスを開始（正規化座標で保存: 0-1の範囲）
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height

    currentPathRef.current = {
      points: [{ x, y }],
      color: penColor,
      width: penSize
    }

    console.log('描画開始')
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ctrl押下中は描画しない
    if (e.ctrlKey || e.metaKey) {
      if (isCurrentlyDrawing) {
        stopDrawing()
      }
      return
    }
    if (!isCurrentlyDrawing || !isDrawingMode || !drawingCanvasRef.current || !currentPathRef.current) return

    const canvas = drawingCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    // 正規化座標で保存
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height

    currentPathRef.current.points.push({ x, y })

    // リアルタイムで描画
    const ctx = canvas.getContext('2d')!
    const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 2]

    ctx.strokeStyle = currentPathRef.current.color
    ctx.lineWidth = currentPathRef.current.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(prevPoint.x * canvas.width, prevPoint.y * canvas.height)
    ctx.lineTo(x * canvas.width, y * canvas.height)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isCurrentlyDrawing && currentPathRef.current) {
      console.log('描画終了')

      // パスを保存
      const newPath = currentPathRef.current
      setDrawingPaths(prev => {
        const newMap = new Map(prev)
        const currentPaths = newMap.get(pageNum) || []
        const newPaths = [...currentPaths, newPath]
        newMap.set(pageNum, newPaths)

        // 履歴に保存
        saveToHistory(newPaths)

        return newMap
      })

      currentPathRef.current = null
      setIsCurrentlyDrawing(false)
    }
  }

  // タッチでの描画機能（1本指）
  const handleDrawingTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return // 1本指のみ
    if (!isDrawingMode || !drawingCanvasRef.current) return

    e.preventDefault()
    setIsCurrentlyDrawing(true)
    const canvas = drawingCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    const touch = e.touches[0]
    const x = (touch.clientX - rect.left) / canvas.width
    const y = (touch.clientY - rect.top) / canvas.height

    currentPathRef.current = {
      points: [{ x, y }],
      color: penColor,
      width: penSize
    }

    console.log('タッチ描画開始')
  }

  const handleDrawingTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return
    if (!isCurrentlyDrawing || !isDrawingMode || !drawingCanvasRef.current || !currentPathRef.current) return

    e.preventDefault()
    const canvas = drawingCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    const touch = e.touches[0]
    const x = (touch.clientX - rect.left) / canvas.width
    const y = (touch.clientY - rect.top) / canvas.height

    currentPathRef.current.points.push({ x, y })

    // リアルタイムで描画
    const ctx = canvas.getContext('2d')!
    const prevPoint = currentPathRef.current.points[currentPathRef.current.points.length - 2]

    ctx.strokeStyle = currentPathRef.current.color
    ctx.lineWidth = currentPathRef.current.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(prevPoint.x * canvas.width, prevPoint.y * canvas.height)
    ctx.lineTo(x * canvas.width, y * canvas.height)
    ctx.stroke()
  }

  const handleDrawingTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      stopDrawing()
    }
  }

  // パン（移動）機能 - Ctrl+ドラッグで移動
  const startPanning = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ctrlキーが押されている場合のみパン開始
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
    // キャンバスをコンテナいっぱいに広げる
    if (!pdfDoc || !containerRef.current || !canvasRef.current) return

    pdfDoc.getPage(pageNum).then(page => {
      const viewport = page.getViewport({ scale: 1 })
      const container = containerRef.current!

      // コンテナのサイズを取得
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // PDFのアスペクト比を維持しながら、コンテナいっぱいに表示する倍率を計算
      const scaleX = containerWidth / viewport.width
      const scaleY = containerHeight / viewport.height
      const fitScale = Math.min(scaleX, scaleY)

      setScale(fitScale)
      setPanOffset({ x: 0, y: 0 })
    })
  }

  // Ctrl+ホイールでズーム（PDFエリア内のみ）
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // containerRef内のイベントかチェック
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          const delta = e.deltaY > 0 ? -0.1 : 0.1
          setScale(prev => Math.max(0.5, Math.min(5, prev + delta)))
        }
      }
    }

    // passive: false で確実にpreventDefaultを有効化
    document.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Ctrlキーの状態を追跡
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
        // Ctrl+Z でアンドゥ
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          const currentPaths = drawingPaths.get(pageNum) || []
          if (currentPaths.length === 0) {
            return
          }

          // 最後のパスを削除
          setDrawingPaths(prev => {
            const newMap = new Map(prev)
            const newPaths = currentPaths.slice(0, -1)
            if (newPaths.length === 0) {
              newMap.delete(pageNum)
            } else {
              newMap.set(pageNum, newPaths)
            }
            return newMap
          })

          addStatusMessage('↩️ 元に戻しました')
        }
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
  }, [pageNum, drawingPaths, addStatusMessage])

  // タッチ操作用の状態
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null)

  // 2点間の距離を計算
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 2点の中心座標を計算
  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  // タッチ開始
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 2本指タッチ - ピンチ・パン用
      e.preventDefault()
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const center = getTouchCenter(e.touches[0], e.touches[1])
      setLastTouchDistance(distance)
      setLastTouchCenter(center)
      console.log('2本指タッチ開始')
    }
  }

  // タッチ移動
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDistance !== null && lastTouchCenter !== null) {
      e.preventDefault()

      const currentDistance = getTouchDistance(e.touches[0], e.touches[1])
      const currentCenter = getTouchCenter(e.touches[0], e.touches[1])

      // ピンチイン・アウトでズーム
      const distanceChange = currentDistance - lastTouchDistance
      if (Math.abs(distanceChange) > 5) {
        const scaleChange = distanceChange * 0.005
        setScale(prev => Math.max(0.5, Math.min(5, prev + scaleChange)))
        setLastTouchDistance(currentDistance)
      }

      // 2本指スワイプでパン
      const dx = currentCenter.x - lastTouchCenter.x
      const dy = currentCenter.y - lastTouchCenter.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        setPanOffset(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }))
        setLastTouchCenter(currentCenter)
      }

      console.log('ピンチ/パン中: scale change =', distanceChange)
    }
  }

  // タッチ終了
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      setLastTouchDistance(null)
      setLastTouchCenter(null)
      console.log('2本指タッチ終了')
    }
  }

  // 描画モードの切り替え
  const toggleDrawingMode = () => {
    if (isDrawingMode) {
      // ペンモード中にクリックした場合はポップアップをトグル
      setShowPenPopup(!showPenPopup)
    } else {
      // ペンモードOFFの場合は、ペンモードをONにする
      setIsDrawingMode(true)
      setIsEraserMode(false) // 消しゴムモードをオフ
      setIsSelectionMode(false) // 採点モードをオフ
      setSelectionRect(null) // 選択範囲をクリア
      setSelectionPreview(null) // プレビューをクリア
      setShowPenPopup(false) // ポップアップは閉じる
      setShowEraserPopup(false) // 消しゴムポップアップを閉じる
      // 選択キャンバスをクリア
      if (selectionCanvasRef.current) {
        const ctx = selectionCanvasRef.current.getContext('2d')!
        ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height)
      }
      console.log('描画モード: ON')
    }
  }

  // 消しゴムモードの切り替え
  const toggleEraserMode = () => {
    if (isEraserMode) {
      // 消しゴムモード中にクリックした場合はポップアップをトグル
      setShowEraserPopup(!showEraserPopup)
    } else {
      // 消しゴムモードOFFの場合は、消しゴムモードをONにする
      setIsEraserMode(true)
      setIsDrawingMode(false) // 描画モードをオフ
      setIsSelectionMode(false) // 採点モードをオフ
      setSelectionRect(null) // 選択範囲をクリア
      setSelectionPreview(null) // プレビューをクリア
      setShowEraserPopup(false) // ポップアップは閉じる
      setShowPenPopup(false) // ペンポップアップを閉じる
      // 選択キャンバスをクリア
      if (selectionCanvasRef.current) {
        const ctx = selectionCanvasRef.current.getContext('2d')!
        ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height)
      }
      console.log('消しゴムモード: ON')
    }
  }

  // 履歴に現在の状態を保存
  const saveToHistory = (paths: DrawingPath[]) => {
    setHistory(prev => {
      const newHistory = new Map(prev)
      const pageHistory = newHistory.get(pageNum) || []
      const currentIndex = historyIndex.get(pageNum) ?? -1

      // 現在のインデックス以降の履歴を削除（新しい操作をした場合）
      const newPageHistory = pageHistory.slice(0, currentIndex + 1)
      newPageHistory.push([...paths])

      // 履歴は最大50ステップまで
      const newIndex = newPageHistory.length > 50 ? 49 : newPageHistory.length - 1
      if (newPageHistory.length > 50) {
        newPageHistory.shift()
      }

      setHistoryIndex(prevIndex => {
        const newIndexMap = new Map(prevIndex)
        newIndexMap.set(pageNum, newIndex)
        return newIndexMap
      })

      newHistory.set(pageNum, newPageHistory)
      return newHistory
    })
  }

  // アンドゥ機能
  const undo = () => {
    const pageHistory = history.get(pageNum) || []
    const currentIndex = historyIndex.get(pageNum) ?? -1

    if (currentIndex <= 0) {
      addStatusMessage('⚠️ 元に戻す操作がありません')
      return
    }

    const newIndex = currentIndex - 1
    const previousPaths = pageHistory[newIndex] || []

    setHistoryIndex(prev => {
      const newMap = new Map(prev)
      newMap.set(pageNum, newIndex)
      return newMap
    })

    setDrawingPaths(prev => {
      const newMap = new Map(prev)
      if (previousPaths.length === 0) {
        newMap.delete(pageNum)
      } else {
        newMap.set(pageNum, [...previousPaths])
      }
      return newMap
    })

    addStatusMessage('↩️ 元に戻しました')
  }

  // 消しゴムの開始
  const startErasing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserMode) return
    setIsErasing(true)
    eraseAtPosition(e)
  }

  // 消しゴムを動かす
  const continueErasing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasing || !isEraserMode) return
    eraseAtPosition(e)
  }

  // 消しゴムを止める
  const stopErasing = () => {
    if (isErasing) {
      // 消しゴム終了時に履歴を保存
      const currentPaths = drawingPaths.get(pageNum) || []
      saveToHistory(currentPaths)
    }
    setIsErasing(false)
  }

  // 指定位置で消しゴム処理
  const eraseAtPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserMode || !drawingCanvasRef.current) return

    const canvas = drawingCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    // 正規化座標で計算（描画時と同じ方法）
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height

    const currentPaths = drawingPaths.get(pageNum) || []

    // クリックした位置に近いパスを探す（ピクセルベースで計算し直す）
    const eraserRadiusPx = eraserSize // 選択された消しゴムサイズ
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
        const clickXPx = x * canvas.width
        const clickYPx = y * canvas.height

        const distance = Math.sqrt(
          Math.pow(pointXPx - clickXPx, 2) + Math.pow(pointYPx - clickYPx, 2)
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

  // クリア機能（現在のページのみ）
  const clearDrawing = () => {
    // 現在のページの描画パスをクリア
    setDrawingPaths(prev => {
      const newMap = new Map(prev)
      newMap.delete(pageNum)

      // 履歴に空の状態を保存
      saveToHistory([])

      return newMap
    })

    if (drawingCanvasRef.current) {
      const ctx = drawingCanvasRef.current.getContext('2d')!
      ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
      console.log('描画をクリアしました')
    }
  }

  // すべてのページの描画をクリア
  const clearAllDrawings = async () => {
    if (!confirm('すべてのページのペン跡を削除しますか？この操作は取り消せません。')) {
      return
    }

    setDrawingPaths(new Map())

    if (drawingCanvasRef.current) {
      const ctx = drawingCanvasRef.current.getContext('2d')!
      ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
    }

    // IndexedDBからも削除
    try {
      const record = await getPDFRecord(pdfId)
      if (record) {
        record.drawings = {}
        await savePDFRecord(record)
        console.log('すべてのペン跡を削除しました:', pdfId)
        addStatusMessage('🗑️ すべてのペン跡を削除しました')
      }
    } catch (error) {
      console.error('ペン跡の削除に失敗:', error)
      addStatusMessage('❌ ペン跡の削除に失敗しました')
    }
  }

  // 採点開始（範囲選択モードに切り替え）
  const startGrading = () => {
    setIsSelectionMode(true)
    setIsDrawingMode(false) // 描画モードをオフ
    setIsEraserMode(false) // 消しゴムモードをオフ
    setShowPenPopup(false) // ポップアップを閉じる
    setShowEraserPopup(false) // ポップアップを閉じる
    setSelectionRect(null) // 選択をクリア
    console.log('採点モード: 範囲を選択してください')
  }

  // 矩形選択モードをキャンセル
  const cancelSelection = () => {
    setIsSelectionMode(false)
    setSelectionRect(null)
    setSelectionPreview(null)
    if (selectionCanvasRef.current) {
      const ctx = selectionCanvasRef.current.getContext('2d')!
      ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height)
    }
    console.log('採点モードをキャンセル')
  }

  // 確認ポップアップから採点を実行
  const confirmAndGrade = () => {
    setSelectionPreview(null) // ポップアップを閉じる
    submitForGrading()
  }

  // 確認ポップアップをキャンセル
  const cancelPreview = () => {
    setSelectionPreview(null)
    // 選択範囲は保持して、再選択できるようにする
  }

  // 矩形選択の開始
  const startSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectionMode || !selectionCanvasRef.current) return

    setIsSelecting(true)
    const canvas = selectionCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setSelectionRect({
      startX: x,
      startY: y,
      endX: x,
      endY: y
    })

    console.log('選択開始:', x, y)
  }

  // 矩形選択の更新
  const updateSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !isSelectionMode || !selectionCanvasRef.current || !selectionRect) return

    const canvas = selectionCanvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

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

  // 矩形選択の終了（確認ポップアップを表示）
  const finishSelection = () => {
    if (isSelecting && selectionRect && canvasRef.current && drawingCanvasRef.current) {
      setIsSelecting(false)
      console.log('選択完了:', selectionRect)

      // 選択範囲が十分な大きさの場合、プレビューを生成
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
        ctx.drawImage(canvasRef.current, x, y, width, height, 0, 0, width, height)

        // 手書きを重ねる
        ctx.drawImage(drawingCanvasRef.current, x, y, width, height, 0, 0, width, height)

        // Base64画像として保存
        const previewData = tempCanvas.toDataURL('image/jpeg', 0.85)
        setSelectionPreview(previewData)
      }
    }
  }

  // 採点機能
  const submitForGrading = async () => {
    if (!drawingCanvasRef.current || !canvasRef.current) return

    setIsGrading(true)
    setGradingError(null) // エラーをクリア
    try {
      // PDFと手書きを合成した画像を作成
      const tempCanvas = document.createElement('canvas')
      const pdfCanvas = canvasRef.current

      let imageData: string

      // 選択範囲がある場合は、その部分だけを切り出す
      if (selectionRect) {
        const { startX, startY, endX, endY } = selectionRect
        const x = Math.min(startX, endX)
        const y = Math.min(startY, endY)
        const width = Math.abs(endX - startX)
        const height = Math.abs(endY - startY)

        // 選択範囲が小さすぎる場合はエラー
        if (width < 10 || height < 10) {
          setGradingError('選択範囲が小さすぎます。もう少し大きな範囲を選択してください。')
          setIsGrading(false)
          return
        }

        // 最大解像度を設定（大きすぎる画像は縮小）
        const maxWidth = 1024
        const maxHeight = 1024
        let targetWidth = width
        let targetHeight = height

        // アスペクト比を維持しながら縮小
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height)
          targetWidth = Math.round(width * scale)
          targetHeight = Math.round(height * scale)
          console.log(`画像を縮小: ${width}x${height} → ${targetWidth}x${targetHeight}`)
        }

        // 切り出し用のキャンバスを作成
        tempCanvas.width = targetWidth
        tempCanvas.height = targetHeight
        const ctx = tempCanvas.getContext('2d')!

        // 高品質な縮小処理
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // PDFの選択範囲を描画（縮小あり）
        ctx.drawImage(pdfCanvas, x, y, width, height, 0, 0, targetWidth, targetHeight)

        // 手書きの選択範囲を重ねる（縮小あり）
        ctx.drawImage(drawingCanvasRef.current, x, y, width, height, 0, 0, targetWidth, targetHeight)

        console.log('選択範囲を採点:', { x, y, width, height, targetWidth, targetHeight })
      } else {
        // 選択範囲がない場合は、ページ全体を送信（最適化）
        const maxWidth = 1536
        const maxHeight = 1536
        let targetWidth = pdfCanvas.width
        let targetHeight = pdfCanvas.height

        // ページ全体も大きすぎる場合は縮小
        if (pdfCanvas.width > maxWidth || pdfCanvas.height > maxHeight) {
          const scale = Math.min(maxWidth / pdfCanvas.width, maxHeight / pdfCanvas.height)
          targetWidth = Math.round(pdfCanvas.width * scale)
          targetHeight = Math.round(pdfCanvas.height * scale)
          console.log(`ページ全体を縮小: ${pdfCanvas.width}x${pdfCanvas.height} → ${targetWidth}x${targetHeight}`)
        }

        tempCanvas.width = targetWidth
        tempCanvas.height = targetHeight
        const ctx = tempCanvas.getContext('2d')!

        // 高品質な縮小処理
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // PDFを描画
        ctx.drawImage(pdfCanvas, 0, 0, targetWidth, targetHeight)

        // 手書きを重ねる
        ctx.drawImage(drawingCanvasRef.current, 0, 0, targetWidth, targetHeight)

        console.log('ページ全体を採点:', { targetWidth, targetHeight })
      }

      // 合成した画像をBase64に変換（JPEG形式、品質85%で圧縮）
      // 品質を少し上げて文字認識精度を向上
      imageData = tempCanvas.toDataURL('image/jpeg', 0.85)

      // データサイズをログ出力
      const sizeInKB = Math.round(imageData.length / 1024)
      console.log(`送信画像サイズ: ${sizeInKB} KB, 画像サイズ: ${tempCanvas.width}x${tempCanvas.height}px`)

      // APIに送信
      const response = await gradeWork(imageData, pageNum)

      if (response.success) {
        setGradingResult(response.result)
        setGradingError(null)
        // 採点成功後、選択モードを解除
        setIsSelectionMode(false)

        // 採点履歴を保存
        try {
          if (response.result.problems && response.result.problems.length > 0) {
            for (const problem of response.result.problems) {
              const historyRecord = {
                id: generateGradingHistoryId(),
                pdfId: pdfId,
                pdfFileName: pdfRecord.fileName,
                pageNumber: pageNum,
                problemNumber: problem.problemNumber,
                studentAnswer: problem.studentAnswer,
                isCorrect: problem.isCorrect,
                correctAnswer: problem.correctAnswer,
                feedback: problem.feedback,
                explanation: problem.explanation,
                timestamp: Date.now(),
                imageData: imageData // 採点時の画像を保存
              }
              await saveGradingHistory(historyRecord)
            }
            console.log('採点履歴を保存しました:', response.result.problems.length, '件')
            addStatusMessage(`✅ 採点履歴を保存しました (${response.result.problems.length}問)`)
          }
        } catch (error) {
          console.error('採点履歴の保存に失敗:', error)
          addStatusMessage('⚠️ 採点履歴の保存に失敗しました')
        }
      } else {
        setGradingError('採点に失敗しました: ' + (response.error || '不明なエラー'))
      }
    } catch (error) {
      console.error('採点エラー:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      // エラーメッセージをより分かりやすくする
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setGradingError('サーバーに接続できませんでした。バックエンドサーバーが起動しているか確認してください。')
      } else if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
        setGradingError('Google AIが過負荷状態です。しばらく待ってから再度お試しください。')
      } else {
        setGradingError('採点中にエラーが発生しました: ' + errorMessage)
      }
    } finally {
      setIsGrading(false)
    }
  }

  // ページ移動
  const goToPrevPage = () => {
    if (pageNum > 1) {
      // ページ移動時に現在のページの履歴をクリア
      setHistory(prev => {
        const newHistory = new Map(prev)
        newHistory.delete(pageNum)
        return newHistory
      })
      setHistoryIndex(prev => {
        const newIndex = new Map(prev)
        newIndex.delete(pageNum)
        return newIndex
      })
      setPageNum(pageNum - 1)
    }
  }

  const goToNextPage = () => {
    if (pageNum < numPages) {
      // ページ移動時に現在のページの履歴をクリア
      setHistory(prev => {
        const newHistory = new Map(prev)
        newHistory.delete(pageNum)
        return newHistory
      })
      setHistoryIndex(prev => {
        const newIndex = new Map(prev)
        newIndex.delete(pageNum)
        return newIndex
      })
      setPageNum(pageNum + 1)
    }
  }

  return (
    <div className="pdf-viewer">
      <div className="toolbar">
        {/* 戻るボタン */}
        {onBack && (
          <>
            <button onClick={onBack} title="管理画面に戻る">
              🏠
            </button>
            <div className="divider"></div>
          </>
        )}

        {/* ページ操作 */}
        <button onClick={goToPrevPage} disabled={pageNum <= 1} title="前のページ">
          ⬅️
        </button>
        <span className="page-info">
          {pageNum} / {numPages}
        </span>
        <button onClick={goToNextPage} disabled={pageNum >= numPages} title="次のページ">
          ➡️
        </button>

        <div className="divider"></div>

        {/* ズーム操作 */}
        <button onClick={resetZoom} title="画面に合わせる">
          <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
            {/* 左上への矢印 */}
            <path fill='currentColor' d='M4,4 L4,9 L6,9 L6,6 L9,6 L9,4 Z M4,4 L2,6 L6,6 Z M4,4 L6,2 L6,6 Z' />
            {/* 右上への矢印 */}
            <path fill='currentColor' d='M20,4 L20,9 L18,9 L18,6 L15,6 L15,4 Z M20,4 L22,6 L18,6 Z M20,4 L18,2 L18,6 Z' />
            {/* 左下への矢印 */}
            <path fill='currentColor' d='M4,20 L4,15 L6,15 L6,18 L9,18 L9,20 Z M4,20 L2,18 L6,18 Z M4,20 L6,22 L6,18 Z' />
            {/* 右下への矢印 */}
            <path fill='currentColor' d='M20,20 L20,15 L18,15 L18,18 L15,18 L15,20 Z M20,20 L22,18 L18,18 Z M20,20 L18,22 L18,18 Z' />
          </svg>
        </button>

        <div className="divider"></div>

        {/* 描画ツール */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={toggleDrawingMode}
            className={isDrawingMode ? 'active' : ''}
            title={isDrawingMode ? 'ペンモード ON' : 'ペンモード OFF'}
          >
            {ICON_SVG.pen(isDrawingMode, penColor)}
          </button>

          {/* ペン設定ポップアップ */}
          {showPenPopup && (
            <div className="tool-popup">
              <div className="popup-row">
                <label>色:</label>
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  style={{ width: '40px', height: '30px', border: '1px solid #ccc', cursor: 'pointer' }}
                />
              </div>
              <div className="popup-row">
                <label>太さ:</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={penSize}
                  onChange={(e) => setPenSize(Number(e.target.value))}
                  style={{ width: '100px' }}
                />
                <span>{penSize}px</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={toggleEraserMode}
            className={isEraserMode ? 'active' : ''}
            title={isEraserMode ? '消しゴムモード ON' : '消しゴムモード OFF'}
          >
            {ICON_SVG.eraser(isEraserMode)}
          </button>

          {/* 消しゴム設定ポップアップ */}
          {showEraserPopup && (
            <div className="tool-popup">
              <div className="popup-row">
                <label>サイズ:</label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(Number(e.target.value))}
                  style={{ width: '100px' }}
                />
                <span>{eraserSize}px</span>
              </div>
            </div>
          )}
        </div>

        {/* 採点ボタン */}
        <button
          onClick={isSelectionMode ? cancelSelection : startGrading}
          className={isSelectionMode ? 'active' : ''}
          disabled={isGrading}
          title={isSelectionMode ? 'キャンセル' : '範囲を選択して採点'}
        >
          {isGrading ? '⏳' : '✅'}
        </button>

        <div className="divider"></div>

        <button
          onClick={undo}
          title="元に戻す (Ctrl+Z)"
        >
          ↩️
        </button>
        <button
          onClick={clearDrawing}
          onDoubleClick={clearAllDrawings}
          title="クリア（ダブルクリックで全ページクリア）"
        >
          🗑️
        </button>

      </div>

      <div
        className="canvas-container"
        ref={containerRef}
        onMouseDown={startPanning}
        onMouseMove={doPanning}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isPanning ? 'grabbing' : (isCtrlPressed && !isDrawingMode ? 'grab' : 'default'),
          overflow: 'hidden',
          touchAction: 'none' // ブラウザのデフォルトタッチ動作を無効化
        }}
      >
        {isLoading && <div className="loading">読み込み中...</div>}
        {error && (
          <div className="error-message">
            <h3>❌ エラー</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{error}</p>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                🏠 管理画面に戻る
              </button>
            )}
            <details style={{ marginTop: '16px' }}>
              <summary>詳細情報</summary>
              <pre>
                PDF ID: {pdfId}
                {'\n'}File Name: {pdfRecord.fileName}
                {'\n'}Worker URL: {pdfjsLib.GlobalWorkerOptions.workerSrc}
              </pre>
            </details>
          </div>
        )}
        <div
          className="canvas-wrapper"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          <canvas ref={canvasRef} className="pdf-canvas" />
          <canvas
            ref={drawingCanvasRef}
            className="drawing-canvas"
            style={{
              cursor: isDrawingMode && !isCtrlPressed
                ? ICON_SVG.penCursor(penColor)
                : isEraserMode
                ? ICON_SVG.eraserCursor
                : 'default',
              pointerEvents: (isDrawingMode || isEraserMode) && !isCtrlPressed ? 'auto' : 'none',
              touchAction: 'none' // タッチ操作のデフォルト動作を無効化
            }}
            onMouseDown={isEraserMode ? startErasing : startDrawing}
            onMouseMove={isEraserMode ? continueErasing : draw}
            onMouseUp={isEraserMode ? stopErasing : stopDrawing}
            onMouseLeave={isEraserMode ? stopErasing : stopDrawing}
            onTouchStart={handleDrawingTouchStart}
            onTouchMove={handleDrawingTouchMove}
            onTouchEnd={handleDrawingTouchEnd}
          />
          <canvas
            ref={selectionCanvasRef}
            className="selection-canvas"
            style={{
              cursor: isSelectionMode ? 'crosshair' : 'default',
              pointerEvents: isSelectionMode ? 'auto' : 'none',
              touchAction: 'none'
            }}
            onMouseDown={startSelection}
            onMouseMove={updateSelection}
            onMouseUp={finishSelection}
            onMouseLeave={finishSelection}
          />
        </div>
      </div>

      {gradingResult && (
        <GradingResult
          result={gradingResult}
          onClose={() => setGradingResult(null)}
          snsLinks={snsLinks}
        />
      )}

      {gradingError && (
        <div className="error-popup">
          <div className="error-popup-content">
            <h3>❌ エラー</h3>
            <p>{gradingError}</p>
            <button onClick={() => setGradingError(null)} className="close-btn">
              閉じる
            </button>
          </div>
        </div>
      )}

      {selectionPreview && (
        <div className="selection-confirm-popup">
          <div className="selection-confirm-content">
            <h3>📐 この範囲を採点しますか？</h3>
            <div className="preview-image-container">
              <img src={selectionPreview} alt="選択範囲のプレビュー" className="preview-image" />
            </div>
            <div className="confirm-buttons">
              <button onClick={cancelPreview} className="cancel-button">
                やり直す
              </button>
              <button onClick={confirmAndGrade} className="confirm-button">
                採点する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ステータスバー */}
      <div className="status-bar">
        <div className="status-messages">
          {statusMessages.length > 0 ? (
            statusMessages.slice(-3).map((msg, idx) => (
              <div key={idx} className="status-message-item">
                {msg}
              </div>
            ))
          ) : (
            <div className="status-message-item">準備完了</div>
          )}
        </div>
        <button
          className="console-button"
          onClick={() => {
            // Chromiumのコンソールを開く（開発者ツール）
            // @ts-ignore
            if (window.require) {
              try {
                // @ts-ignore
                window.require('electron').remote.getCurrentWindow().webContents.openDevTools()
              } catch (e) {
                alert('開発者ツールを開けません。F12キーを押してください。')
              }
            } else {
              alert('F12キーを押して開発者コンソールを開いてください。')
            }
          }}
          title="開発者コンソールを開く（F12）"
        >
          🔧
        </button>
      </div>
    </div>
  )
}

export default PDFViewer
