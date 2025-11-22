import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { gradeWork, GradingResult as GradingResultType } from '../../services/api'
import GradingResult from '../grading/GradingResult'
import { savePDFRecord, getPDFRecord, getAllSNSLinks, SNSLinkRecord, PDFFileRecord, saveGradingHistory, generateGradingHistoryId, getAppSettings } from '../../utils/indexedDB'
import { ICON_SVG } from '../../constants/icons'
import { usePDFRenderer } from '../../hooks/pdf/usePDFRenderer'
import { useDrawing, DrawingPath } from '../../hooks/pdf/useDrawing'
import { useZoomPan } from '../../hooks/pdf/useZoomPan'
import { useEraser } from '../../hooks/pdf/useEraser'
import { useSelection, SelectionRect } from '../../hooks/pdf/useSelection'
import './PDFViewer.css'

// PDF.jsのworkerを設定（ローカルファイルを使用、Safari/Edge対応）
pdfjsLib.GlobalWorkerOptions.workerSrc = '/HomeTeacher/pdf.worker.min.js'

interface PDFViewerProps {
  pdfRecord: PDFFileRecord // PDFファイルレコード全体を受け取る
  pdfId: string // IndexedDBのレコードID
  onBack?: () => void // 管理画面に戻るコールバック
}

const PDFViewer = ({ pdfRecord, pdfId, onBack }: PDFViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)  // canvas-container
  const wrapperRef = useRef<HTMLDivElement>(null)      // canvas-wrapper
  const layerRef = useRef<HTMLDivElement>(null)        // canvas-layer

  // ステータスメッセージ（コンソールログのみ）
  const addStatusMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP')
    const fullMessage = `[${timestamp}] ${message}`
    console.log(fullMessage)
  }

  // usePDFRenderer hook を使用してPDF読み込みを管理
  const {
    pdfDoc,
    pageNum,
    setPageNum,
    numPages,
    isLoading,
    error,
    goToPrevPage,
    goToNextPage
  } = usePDFRenderer(pdfRecord, containerRef, canvasRef, {
    onLoadStart: () => {
      addStatusMessage('💾 PDFを読み込み中...')
    },
    onLoadSuccess: (numPages) => {
      addStatusMessage(`✅ PDF読み込み成功: ${numPages}ページ`)
    },
    onLoadError: (errorMsg) => {
      addStatusMessage(`❌ ${errorMsg}`)
    }
  })

  // レンダリングタスク管理用（PDFViewer側で管理）
  const renderTaskRef = useRef<any>(null)

  // useDrawing hook を使用して描画機能を管理
  const {
    drawingPaths,
    setDrawingPaths,
    isCurrentlyDrawing,
    startDrawing: hookStartDrawing,
    continueDrawing: hookContinueDrawing,
    stopDrawing: hookStopDrawing,
    clearDrawing: hookClearDrawing,
    clearAllDrawings: hookClearAllDrawings,
    redrawPaths
  } = useDrawing(pageNum)

  // PDFレンダリング時に使用する実際のスケール（5倍固定で高解像度化）
  const RENDER_SCALE = 5.0
  const [renderScale, setRenderScale] = useState(RENDER_SCALE)

  // useZoomPan hook を使用してズーム・パン機能を管理
  const {
    zoom,
    setZoom,
    isPanning,
    panOffset,
    setPanOffset,
    isCtrlPressed,
    startPanning,
    doPanning,
    stopPanning,
    resetZoom: hookResetZoom,
    lastWheelCursor
  } = useZoomPan(wrapperRef, RENDER_SCALE)
  
  const displayZoom = Math.round(renderScale * zoom * 100)
  
  // renderPage完了を通知するためのカウンター
  const [renderCompleteCounter, setRenderCompleteCounter] = useState(0)

  // プリレンダリング戦略: zoomは 1/RENDER_SCALE ～ 1.0 の範囲
  // 初期値は 1/3 (等倍表示)、最大1.0まで拡大可能
  // renderScale は常に 3.0 固定、zoom のみが変化

  const toCanvasCoordinates = (clientX: number, clientY: number, rect: DOMRect) => {
    // スクリーン座標からcanvas座標への変換
    // canvas-layerは transform: translate(panOffset) scale(zoom) がかかっている
    // スクリーン座標 = (canvas座標 * zoom) + panOffset + rect位置
    // ∴ canvas座標 = (スクリーン座標 - rect位置 - panOffset) / zoom
    const safeZoom = zoom || 1
    return {
      x: (clientX - rect.left - panOffset.x) / safeZoom,
      y: (clientY - rect.top - panOffset.y) / safeZoom
    }
  }

  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [isEraserMode, setIsEraserMode] = useState(false)

  // 2本指タップ検出用
  const twoFingerTapStartTimeRef = useRef<number | null>(null)
  const initialPinchDistanceRef = useRef<number | null>(null)

  // ペンの設定
  const [penColor, setPenColor] = useState('#FF0000')
  const [penSize, setPenSize] = useState(3)
  const [showPenPopup, setShowPenPopup] = useState(false)

  // 消しゴムの設定
  const [eraserSize, setEraserSize] = useState(20)
  const [showEraserPopup, setShowEraserPopup] = useState(false)
  const [eraserCursorPos, setEraserCursorPos] = useState<{x: number, y: number} | null>(null)

  // useEraser hook を使用して消しゴム機能を管理
  const {
    isErasing,
    startErasing: hookStartErasing,
    eraseAtPosition: hookEraseAtPosition,
    stopErasing: hookStopErasing
  } = useEraser(pageNum, drawingPaths, setDrawingPaths, eraserSize)
  const [isGrading, setIsGrading] = useState(false)
  const [gradingResult, setGradingResult] = useState<GradingResultType | null>(null)
  const [gradingError, setGradingError] = useState<string | null>(null)

  // useSelection hook を使用して矩形選択機能を管理
  const {
    isSelectionMode,
    setIsSelectionMode,
    isSelecting,
    selectionRect,
    setSelectionRect,
    selectionPreview,
    setSelectionPreview,
    startSelection: hookStartSelection,
    updateSelection: hookUpdateSelection,
    finishSelection: hookFinishSelection,
    cancelSelection
  } = useSelection()

  // SNSリンク
  const [snsLinks, setSnsLinks] = useState<SNSLinkRecord[]>([])
  const [snsTimeLimit, setSnsTimeLimit] = useState<number>(30) // デフォルト30分

  // SNSリンクと設定を読み込む
  useEffect(() => {
    const loadSNSData = async () => {
      try {
        const links = await getAllSNSLinks()
        setSnsLinks(links)
        const settings = await getAppSettings()
        setSnsTimeLimit(settings.snsTimeLimitMinutes)
      } catch (error) {
        console.error('Failed to load SNS data:', error)
      }
    }
    loadSNSData()
  }, [])

  // アンドゥ・リドゥ用の履歴（ページごと）
  const [history, setHistory] = useState<Map<number, DrawingPath[][]>>(new Map())
  const [historyIndex, setHistoryIndex] = useState<Map<number, number>>(new Map())

  // ペン跡が変更されたら自動保存（デバウンス付き）
  useEffect(() => {
    if (!pdfId) {
      console.log('⚠️ pdfIdが未設定のため保存をスキップ')
      return
    }

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

  // ページ番号が変更されたら保存
  useEffect(() => {
    if (!pdfId) return

    const savePageNumber = async () => {
      try {
        const record = await getPDFRecord(pdfId)
        if (record) {
          record.lastPageNumber = pageNum
          record.lastOpened = Date.now()
          await savePDFRecord(record)
          console.log(`💾 現在のページ番号 (${pageNum}) を保存しました`)
        }
      } catch (error) {
        console.error('ページ番号の保存失敗:', error)
      }
    }

    savePageNumber()
  }, [pageNum, pdfId])

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

  // 保存されているペン跡を読み込む（PDF読み込み完了後）
  useEffect(() => {
    if (!pdfDoc) return

    const loadDrawings = async () => {
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
        }
      } catch (error) {
        console.error('ペン跡の復元に失敗:', error)
      }
    }

    loadDrawings()
  }, [pdfDoc, pdfId])

  // 初回ロード時のフラグ（ローカル描画用）
  const [isInitialDrawLoad, setIsInitialDrawLoad] = useState(true)
  const [isInitialPositionSet, setIsInitialPositionSet] = useState(false)

  // ページをレンダリング（描画キャンバス用）
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return

    const renderPage = async () => {
      // 前回のレンダリングタスクをキャンセル
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      const page = await pdfDoc.getPage(pageNum)

      // PDFの元のrotation属性を安全に取得
      let pageRotation = 0
      try {
        // page.rotateは0, 90, 180, 270のいずれか（undefinedの場合もある）
        const rotate = page.rotate
        if (typeof rotate === 'number' && [0, 90, 180, 270].includes(rotate)) {
          pageRotation = rotate
          console.log(`📄 ページ ${pageNum}: rotation=${pageRotation}度`)
        }
      } catch (error) {
        console.warn('⚠️ rotation属性取得エラー（0度として処理）:', error)
      }

      // プリレンダリング戦略: 常に RENDER_SCALE でレンダリング
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: pageRotation })

      const canvas = canvasRef.current!
      const context = canvas.getContext('2d')!

      // Canvas サイズ設定（3倍サイズ）
      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      try {
        renderTaskRef.current = page.render(renderContext)
        await renderTaskRef.current.promise
        renderTaskRef.current = null
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') {
          return
        }
        throw error
      }

      // 描画キャンバスのサイズを更新（再描画は別のuseEffectで行う）
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.width = viewport.width
        drawingCanvasRef.current.height = viewport.height
        
        const ctx = drawingCanvasRef.current.getContext('2d')!
        ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
      }

      // 矩形選択Canvas（canvas-wrapperの外にあるので、wrapperサイズに合わせる）
      if (selectionCanvasRef.current && wrapperRef.current) {
        const wrapper = wrapperRef.current
        selectionCanvasRef.current.width = wrapper.clientWidth
        selectionCanvasRef.current.height = wrapper.clientHeight
      }
      
      // 初回ロードフラグをクリア
      if (isInitialDrawLoad) {
        setIsInitialDrawLoad(false)
      }
      
      // ページ読み込み後、自動的に画面フィット＆中央配置
      requestAnimationFrame(() => {
        applyFitAndCenter()
        
        // renderPage完了を通知（これにより再描画useEffectがトリガーされる）
        setRenderCompleteCounter(prev => prev + 1)
      })
    }

    renderPage()

    // クリーンアップ: コンポーネントのアンマウント時にレンダリングをキャンセル
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNum, renderScale])

  // renderPage完了後、またはdrawingPaths変更時に再描画
  useEffect(() => {
    if (!drawingCanvasRef.current || renderCompleteCounter === 0) return
    
    const currentPaths = drawingPaths.get(pageNum) || []
    const ctx = drawingCanvasRef.current.getContext('2d')!
    
    ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height)
    
    if (currentPaths.length > 0) {
      redrawPaths(ctx, currentPaths)
    }
  }, [renderCompleteCounter, pageNum, drawingPaths])

  // 初回ロード時: PDFを中央に配置
  useEffect(() => {
    if (!isInitialDrawLoad && !isInitialPositionSet && canvasRef.current && wrapperRef.current) {
      const wrapper = wrapperRef.current
      const canvas = canvasRef.current
      
      // canvas幅が設定されるまで待つ
      if (canvas.width === 0 || canvas.height === 0) return
      
      const wrapperWidth = wrapper.clientWidth
      const wrapperHeight = wrapper.clientHeight
      
      // zoom=1/3 での表示サイズ
      const displayWidth = canvas.width * zoom
      const displayHeight = canvas.height * zoom
      
      // 中央配置のためのpanOffset計算
      const centerX = (wrapperWidth - displayWidth) / 2
      const centerY = (wrapperHeight - displayHeight) / 2
      
      setPanOffset({ x: centerX, y: centerY })
      setIsInitialPositionSet(true)
      
      // 配置完了後、次のフレームでcanvasを表示
      requestAnimationFrame(() => {
        const canvasLayer = document.querySelector('.canvas-layer') as HTMLElement
        if (canvasLayer) {
          canvasLayer.style.opacity = '1'
        }
      })
    }
  }, [isInitialDrawLoad, isInitialPositionSet, zoom])

  // 画面フィット＆中央配置の共通関数
  const applyFitAndCenter = () => {
    if (!canvasRef.current || !containerRef.current || !wrapperRef.current) return

    const container = containerRef.current
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    // canvas は RENDER_SCALE でレンダリングされている
    // 実際のPDFサイズは canvas.width / RENDER_SCALE
    const actualPdfWidth = canvas.width / RENDER_SCALE
    const actualPdfHeight = canvas.height / RENDER_SCALE
    
    // 画面にフィットさせるスケールを計算
    const scaleX = containerWidth / actualPdfWidth
    const scaleY = containerHeight / actualPdfHeight
    const fitScale = Math.min(scaleX, scaleY) * 0.95 // 95%に縮小して余白を確保
    
    // fitScale は実際のPDF基準なので、zoom値に変換
    // zoom = fitScale / RENDER_SCALE
    const fitZoom = fitScale / RENDER_SCALE
    
    // zoom範囲 1/RENDER_SCALE ～ 1.0 に制限
    const clampedZoom = Math.max(1.0 / RENDER_SCALE, Math.min(1.0, fitZoom))
    
    setZoom(clampedZoom)
    
    // 中央配置を計算（wrapperを基準に）
    const wrapperWidth = wrapper.clientWidth
    const wrapperHeight = wrapper.clientHeight
    const displayWidth = canvas.width * clampedZoom
    const displayHeight = canvas.height * clampedZoom
    
    const centerX = (wrapperWidth - displayWidth) / 2
    const centerY = (wrapperHeight - displayHeight) / 2
    
    setPanOffset({ x: centerX, y: centerY })
  }
  // 描画機能（パスとして保存）
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ctrl押下中は描画しない
    if (e.ctrlKey || e.metaKey) return
    if (!isDrawingMode || !drawingCanvasRef.current || !wrapperRef.current) return

    const canvas = drawingCanvasRef.current
    const rect = wrapperRef.current.getBoundingClientRect()
    const { x, y } = toCanvasCoordinates(e.clientX, e.clientY, rect)

    hookStartDrawing(canvas, x, y, penColor, penSize)
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
    if (!isCurrentlyDrawing || !isDrawingMode || !drawingCanvasRef.current || !wrapperRef.current) return

    const canvas = drawingCanvasRef.current
    const rect = wrapperRef.current.getBoundingClientRect()
    const { x, y } = toCanvasCoordinates(e.clientX, e.clientY, rect)

    hookContinueDrawing(canvas, x, y)
  }

  const stopDrawing = () => {
    if (isCurrentlyDrawing) {
      console.log('描画終了')

      // onSaveコールバックで履歴を保存
      hookStopDrawing((newPaths) => {
        saveToHistory(newPaths)
      })
    }
  }

  // 2本指タップによるアンドゥ検出
  const handleTwoFingerTap = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // 2本指でタッチした時点の時刻と距離を記録
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      twoFingerTapStartTimeRef.current = Date.now()
      initialPinchDistanceRef.current = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
    }
  }

  const handleTwoFingerTapEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // 2本指が離れた時、タップ判定
    if (e.changedTouches.length === 2 && twoFingerTapStartTimeRef.current && initialPinchDistanceRef.current !== null) {
      const tapDuration = Date.now() - twoFingerTapStartTimeRef.current

      // 現在の2本指の距離を計算（ピンチズームと区別するため）
      const touch1 = e.changedTouches[0]
      const touch2 = e.changedTouches[1]
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      const distanceChange = Math.abs(currentDistance - initialPinchDistanceRef.current)

      // タップ判定: 短時間（300ms以内）& 指の距離がほぼ変わらない（20px以内）
      if (tapDuration < 300 && distanceChange < 20) {
        e.preventDefault()
        console.log('👆👆 2本指タップ検出 - アンドゥ実行')

        // 既存のundo()関数を呼び出し
        undo()

        // 振動フィードバック（対応デバイスのみ）
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }

      // リセット
      twoFingerTapStartTimeRef.current = null
      initialPinchDistanceRef.current = null
    }
  }

  // タッチでの描画機能（Apple Pencil対応 + パームリジェクション）
  const handleDrawingTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // 2本指タップ検出を先に実行
    handleTwoFingerTap(e)

    if (!drawingCanvasRef.current) return
    if (!isDrawingMode && !isEraserMode) return

    // パームリジェクション: Apple Pencilのみを受け付ける
    // touchType が "stylus" の場合のみ描画を開始
    const touch = e.touches[0]
    
    // Apple Pencilかどうかを判定
    // @ts-ignore - touchType は標準プロパティだが型定義にない場合がある
    const touchType = touch.touchType || 'direct'
    
    console.log('✋ Touch Start:', {
      touchCount: e.touches.length,
      touchType: touchType,
      // @ts-ignore
      force: touch.force,
      // @ts-ignore
      radiusX: touch.radiusX,
      // @ts-ignore
      radiusY: touch.radiusY
    })

    // Apple Pencil (stylus) 以外は無視（パームリジェクション）
    if (touchType !== 'stylus') {
      console.log('⚠️ 指またはパームタッチを無視:', touchType)
      return
    }

    // 2本以上のタッチは無視（ピンチズームなど）
    if (e.touches.length !== 1) return

    e.preventDefault()
    const canvas = drawingCanvasRef.current
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()

    const { x, y } = toCanvasCoordinates(touch.clientX, touch.clientY, rect)

    if (isEraserMode) {
      hookStartErasing()
      hookEraseAtPosition(canvas, x, y)
    } else if (isDrawingMode) {
      hookStartDrawing(canvas, x, y, penColor, penSize)
    }
  }

  const handleDrawingTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingCanvasRef.current) return

    // 描画中または消しゴム使用中のみ処理
    if (!isCurrentlyDrawing && !isErasing) return

    // 最初のタッチのみを処理（Apple Pencilのタッチ）
    if (e.touches.length !== 1) return

    const touch = e.touches[0]
    
    // Apple Pencilかどうかを判定
    // @ts-ignore
    const touchType = touch.touchType || 'direct'
    
    // Apple Pencil以外は無視
    if (touchType !== 'stylus') {
      return
    }

    e.preventDefault()
    const canvas = drawingCanvasRef.current
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()

    const { x, y } = toCanvasCoordinates(touch.clientX, touch.clientY, rect)

    // カーソル位置を更新（消しゴムモード中）
    if (isEraserMode) {
      setEraserCursorPos({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      })
    }

    if (isEraserMode && isErasing) {
      hookEraseAtPosition(canvas, x, y)
    } else if (isDrawingMode && isCurrentlyDrawing) {
      hookContinueDrawing(canvas, x, y)
    }
  }

  const handleDrawingTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // 2本指タップ終了検出を先に実行
    handleTwoFingerTapEnd(e)

    // すべてのタッチが終了したら描画を終了
    if (e.touches.length === 0) {
      // カーソルを非表示
      setEraserCursorPos(null)

      if (isEraserMode && isErasing) {
        hookStopErasing((newPaths) => {
          saveToHistory(newPaths)
        })
      } else if (isDrawingMode && isCurrentlyDrawing) {
        stopDrawing()
      }
    }
  }

  // ズーム機能（3倍プリレンダリング戦略：画面にフィットするzoomを計算して中央配置）
  const resetZoom = () => {
    applyFitAndCenter()
  }

  // Ctrl+Z でアンドゥ機能
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
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

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [pageNum, drawingPaths, addStatusMessage])

  /**
   * ピンチズーム用の状態管理（正しい実装）
   * 
   * touchstart時の初期値を保存し、touchmoveでは初期値から毎回計算
   * これにより累積誤差が発生しない
   */
  const initialPinchDistanceRef = useRef<number | null>(null)
  const initialScaleRef = useRef<number>(1)
  const initialPanOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pinchCenterRef = useRef<{ x: number; y: number } | null>(null)

  /**
   * 2本指タッチ開始ハンドラ（ピンチズーム）
   */
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t1 = e.touches[0]
      const t2 = e.touches[1]

      // 2点間の距離
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // 初期値を保存
      initialPinchDistanceRef.current = distance
      initialScaleRef.current = zoom
      initialPanOffsetRef.current = { x: panOffset.x, y: panOffset.y }

      // ピンチの中心点（wrapper基準の座標）
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect()
        pinchCenterRef.current = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top
        }
      }
    }
  }

  /**
   * 2本指タッチ移動ハンドラ（ピンチズーム）
   * 
   * 公式: newOrigin = pinchCenter - (pinchCenter - initialOrigin) × (newScale / initialScale)
   * これにより、ピンチ中心点が指す内容は常に同じ位置に留まる
   */
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || initialPinchDistanceRef.current === null || !pinchCenterRef.current) {
      return
    }

    e.preventDefault()
    const t1 = e.touches[0]
    const t2 = e.touches[1]

    // 現在の距離
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    const currentDistance = Math.sqrt(dx * dx + dy * dy)

    // スケール比率
    const ratio = currentDistance / initialPinchDistanceRef.current
    // プリレンダリング: zoom範囲 1/RENDER_SCALE ～ 1.0
    const newZoom = Math.max(1.0 / RENDER_SCALE, Math.min(1.0, initialScaleRef.current * ratio))

    // 現在の指の中心位置（wrapper基準）
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const currentPinchCenterX = (t1.clientX + t2.clientX) / 2 - rect.left
    const currentPinchCenterY = (t1.clientY + t2.clientY) / 2 - rect.top

    // ピンチ開始時の中心点を基準にした位置計算
    const newOriginX = pinchCenterRef.current.x - 
      (pinchCenterRef.current.x - initialPanOffsetRef.current.x) * (newZoom / initialScaleRef.current)
    const newOriginY = pinchCenterRef.current.y - 
      (pinchCenterRef.current.y - initialPanOffsetRef.current.y) * (newZoom / initialScaleRef.current)

    // 指の移動によるパン
    const panX = currentPinchCenterX - pinchCenterRef.current.x
    const panY = currentPinchCenterY - pinchCenterRef.current.y

    setPanOffset({ x: newOriginX + panX, y: newOriginY + panY })
    setZoom(newZoom)
  }

  /**
   * 2本指タッチ終了ハンドラ
   */
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null
      pinchCenterRef.current = null
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

  // 消しゴムの開始（フックの関数を使用）
  const startErasing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserMode) return
    hookStartErasing()
    eraseAtPosition(e)
    
    // カーソル位置を更新
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setEraserCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
  }

  // 消しゴムを動かす（フックの関数を使用）
  const continueErasing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // カーソル位置を更新（消しゴムモード中は常に表示）
    if (isEraserMode && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setEraserCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    
    if (!isErasing || !isEraserMode) return
    eraseAtPosition(e)
  }

  // 消しゴムを止める（フックの関数を使用）
  const stopErasing = () => {
    hookStopErasing((currentPaths) => {
      saveToHistory(currentPaths)
    })
  }

  // 消しゴムモード終了時にカーソルを非表示
  const handleEraserMouseLeave = () => {
    setEraserCursorPos(null)
    stopErasing()
  }

  // 指定位置で消しゴム処理（フックの関数を使用）
  const eraseAtPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserMode || !drawingCanvasRef.current || !wrapperRef.current) return

    const canvas = drawingCanvasRef.current
    const rect = wrapperRef.current.getBoundingClientRect()
    const { x, y } = toCanvasCoordinates(e.clientX, e.clientY, rect)

    hookEraseAtPosition(canvas, x, y)
  }

  // クリア機能（現在のページのみ）
  const clearDrawing = () => {
    // 履歴に空の状態を保存
    saveToHistory([])

    // フックのクリア機能を使用
    hookClearDrawing()

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

    // フックのクリア機能を使用
    hookClearAllDrawings()

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
    addStatusMessage('📱 採点モード開始')
    setIsSelectionMode(true)
    setIsDrawingMode(false) // 描画モードをオフ
    setIsEraserMode(false) // 消しゴムモードをオフ
    setShowPenPopup(false) // ポップアップを閉じる
    setShowEraserPopup(false) // ポップアップを閉じる
    setSelectionRect(null) // 選択をクリア
    addStatusMessage('採点モード: 範囲を選択してください')
    addStatusMessage('📐 採点範囲を選択してください')
  }

  // 矩形選択モードをキャンセル（フックの関数を使用し、キャンバスもクリア）
  const handleCancelSelection = () => {
    cancelSelection() // フックの関数を呼び出す
    if (selectionCanvasRef.current) {
      const ctx = selectionCanvasRef.current.getContext('2d')!
      ctx.clearRect(0, 0, selectionCanvasRef.current.width, selectionCanvasRef.current.height)
    }
    addStatusMessage('採点モードをキャンセル')
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

  // 矩形選択の開始（フックの関数を使用）
  const startSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectionMode || !selectionCanvasRef.current) return

    const canvas = selectionCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    hookStartSelection(canvas, x, y)
  }

  // 矩形選択の更新（フックの関数を使用）
  const updateSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !isSelectionMode || !selectionCanvasRef.current) return

    const canvas = selectionCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    hookUpdateSelection(canvas, x, y)
  }

  // 矩形選択の終了（フックの関数を使用）
  const finishSelection = () => {
    if (!canvasRef.current || !drawingCanvasRef.current) return
    hookFinishSelection(canvasRef.current, drawingCanvasRef.current, zoom, panOffset, RENDER_SCALE, selectionCanvasRef.current)
  }

  // 採点機能
  const submitForGrading = async () => {
    if (!drawingCanvasRef.current || !canvasRef.current) return

    setIsGrading(true)
    setGradingError(null) // エラーをクリア
    try {
      console.log('📱 採点開始 - デバイス情報:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height,
        selectionRect: selectionRect,
        hasSelectionPreview: !!selectionPreview
      })

      let imageData: string

      // selectionPreviewがある場合は、それを直接使用（確認ダイアログで表示された画像）
      // これにより座標変換の問題を回避
      if (selectionPreview) {
        console.log('✅ 確認ダイアログの画像を使用')
        imageData = selectionPreview
      } else if (selectionRect) {
        // selectionPreviewがない場合の旧ロジック（後方互換性のため残す）
        console.log('⚠️ selectionPreviewが存在しないため、座標から画像を生成')

        // PDFと手書きを合成した画像を作成
        const tempCanvas = document.createElement('canvas')
        const pdfCanvas = canvasRef.current

        const { startX, startY, endX, endY } = selectionRect
        const x = Math.min(startX, endX)
        const y = Math.min(startY, endY)
        const width = Math.abs(endX - startX)
        const height = Math.abs(endY - startY)

        console.log('📐 選択範囲:', { x, y, width, height })

        // 選択範囲が小さすぎる場合はエラー
        if (width < 10 || height < 10) {
          setGradingError('選択範囲が小さすぎます。もう少し大きな範囲を選択してください。')
          setIsGrading(false)
          return
        }

        // iPad対応: 最大解像度制限（メモリ節約のため）
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const maxWidth = isIOS ? 800 : 1600
        const maxHeight = isIOS ? 800 : 1600
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
        try {
          tempCanvas.width = targetWidth
          tempCanvas.height = targetHeight
        } catch (error) {
          console.error('❌ Canvas作成エラー:', error)
          throw new Error(`Canvas作成失敗 (${targetWidth}x${targetHeight}): ${error instanceof Error ? error.message : String(error)}`)
        }

        const ctx = tempCanvas.getContext('2d')
        if (!ctx) {
          throw new Error('Canvas 2Dコンテキストの取得に失敗しました')
        }

        // 高品質な縮小処理
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        try {
          // PDFの選択範囲を描画（縮小あり）
          ctx.drawImage(pdfCanvas, x, y, width, height, 0, 0, targetWidth, targetHeight)

          // 手書きの選択範囲を重ねる（縮小あり）
          ctx.drawImage(drawingCanvasRef.current, x, y, width, height, 0, 0, targetWidth, targetHeight)
        } catch (error) {
          console.error('❌ Canvas描画エラー:', error)
          throw new Error(`Canvas描画失敗: ${error instanceof Error ? error.message : String(error)}`)
        }

        console.log('✅ 選択範囲を採点:', { x, y, width, height, targetWidth, targetHeight })

        // 合成した画像をBase64に変換
        const quality = isIOS ? 0.75 : 0.85
        try {
          imageData = tempCanvas.toDataURL('image/jpeg', quality)
        } catch (error) {
          console.error('❌ toDataURL failed:', error)
          throw new Error(`画像変換エラー: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        // 選択範囲がない場合は、ページ全体を送信（最適化）
        const tempCanvas = document.createElement('canvas')
        const pdfCanvas = canvasRef.current

        // iPad対応: 最大解像度制限
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const maxWidth = isIOS ? 1200 : 2048
        const maxHeight = isIOS ? 1200 : 2048
        let targetWidth = pdfCanvas.width
        let targetHeight = pdfCanvas.height

        console.log('📄 ページ全体:', { originalWidth: pdfCanvas.width, originalHeight: pdfCanvas.height })

        // ページ全体も大きすぎる場合は縮小
        if (pdfCanvas.width > maxWidth || pdfCanvas.height > maxHeight) {
          const scale = Math.min(maxWidth / pdfCanvas.width, maxHeight / pdfCanvas.height)
          targetWidth = Math.round(pdfCanvas.width * scale)
          targetHeight = Math.round(pdfCanvas.height * scale)
          console.log(`ページ全体を縮小: ${pdfCanvas.width}x${pdfCanvas.height} → ${targetWidth}x${targetHeight}`)
        }

        try {
          tempCanvas.width = targetWidth
          tempCanvas.height = targetHeight
        } catch (error) {
          console.error('❌ Canvas作成エラー:', error)
          throw new Error(`Canvas作成失敗 (${targetWidth}x${targetHeight}): ${error instanceof Error ? error.message : String(error)}`)
        }

        const ctx = tempCanvas.getContext('2d')
        if (!ctx) {
          throw new Error('Canvas 2Dコンテキストの取得に失敗しました')
        }

        // 高品質な縮小処理
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        try {
          // PDFを描画
          ctx.drawImage(pdfCanvas, 0, 0, targetWidth, targetHeight)

          // 手書きを重ねる
          ctx.drawImage(drawingCanvasRef.current, 0, 0, targetWidth, targetHeight)
        } catch (error) {
          console.error('❌ Canvas描画エラー:', error)
          throw new Error(`Canvas描画失敗: ${error instanceof Error ? error.message : String(error)}`)
        }

        console.log('✅ ページ全体を採点:', { targetWidth, targetHeight })

        // 合成した画像をBase64に変換
        const quality = isIOS ? 0.75 : 0.85
        try {
          imageData = tempCanvas.toDataURL('image/jpeg', quality)
        } catch (error) {
          console.error('❌ toDataURL failed:', error)
          // iPadで失敗した場合、さらに品質を下げて再試行
          if (isIOS) {
            console.log('🔄 品質を下げて再試行 (quality=0.6)...')
            try {
              imageData = tempCanvas.toDataURL('image/jpeg', 0.6)
            } catch (retryError) {
              console.error('❌ 再試行も失敗:', retryError)
              throw new Error(`画像変換エラー (品質:${quality}): ${error instanceof Error ? error.message : String(error)}`)
            }
          } else {
            throw new Error(`画像変換エラー: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }

      // データサイズをログ出力
      const sizeInKB = Math.round(imageData.length / 1024)
      console.log(`送信画像サイズ: ${sizeInKB} KB`)

      // 画像サイズが大きすぎる場合は警告
      if (sizeInKB > 5000) {
        console.warn('⚠️ 画像サイズが大きすぎます:', sizeInKB, 'KB')
      }

      // APIに送信
      console.log('📤 APIに送信中...')
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
      console.error('❌ 採点エラー:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      // エラーメッセージをより分かりやすくする
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setGradingError('サーバーに接続できませんでした。ネットワーク接続とバックエンドサーバーの起動状態を確認してください。')
        addStatusMessage('❌ サーバー接続エラー')
      } else if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
        setGradingError('Google AIが過負荷状態です。しばらく待ってから再度お試しください。')
        addStatusMessage('⚠️ AI過負荷')
      } else if (errorMessage.includes('Canvas作成') || errorMessage.includes('Canvas描画')) {
        setGradingError(`画像処理エラー: ${errorMessage}\n\nPDFの解像度が高すぎる可能性があります。ページをズームアウトしてから再度お試しください。`)
        addStatusMessage('❌ Canvas処理エラー')
      } else if (errorMessage.includes('toDataURL') || errorMessage.includes('画像変換')) {
        setGradingError(`画像変換エラー: ${errorMessage}\n\niPadのメモリ不足の可能性があります。他のアプリを閉じてから再度お試しください。`)
        addStatusMessage('❌ 画像変換エラー')
      } else {
        setGradingError('採点中にエラーが発生しました: ' + errorMessage)
        addStatusMessage('❌ 採点エラー')
      }
    } finally {
      setIsGrading(false)
    }
  }

  // ページ移動（履歴クリア機能付き）
  const handleGoToPrevPage = () => {
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
      goToPrevPage() // フックの関数を使用
    }
  }

  const handleGoToNextPage = () => {
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
      goToNextPage() // フックの関数を使用
    }
  }

  return (
    <div className="pdf-viewer-container">
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
        <span className="zoom-info">{displayZoom}%</span>

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
          onClick={isSelectionMode ? handleCancelSelection : startGrading}
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
          touchAction: 'none', // ブラウザのデフォルトタッチ動作を無効化
          position: 'relative' // デバッグマーカーの基準点
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
        <div className="canvas-wrapper" ref={wrapperRef}>
          <div
            className="canvas-layer"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: 'none',
              opacity: isInitialPositionSet ? 1 : 0
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
                touchAction: 'none'
              }}
              onMouseDown={isEraserMode ? startErasing : startDrawing}
              onMouseMove={isEraserMode ? continueErasing : draw}
              onMouseUp={isEraserMode ? stopErasing : stopDrawing}
              onMouseLeave={isEraserMode ? handleEraserMouseLeave : stopDrawing}
              onTouchStart={handleDrawingTouchStart}
              onTouchMove={handleDrawingTouchMove}
              onTouchEnd={handleDrawingTouchEnd}
            />
          </div>
          
          {/* 矩形選択Canvas（transformの影響を受けないようにcanvas-layerの外に配置） */}
          <canvas
            ref={selectionCanvasRef}
            className="selection-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              cursor: isSelectionMode ? 'crosshair' : 'default',
              pointerEvents: isSelectionMode ? 'auto' : 'none',
              touchAction: 'none'
            }}
            onMouseDown={startSelection}
            onMouseMove={updateSelection}
            onMouseUp={finishSelection}
            onMouseLeave={finishSelection}
            onTouchStart={(e) => {
              if (!isSelectionMode || !selectionCanvasRef.current) return
              e.preventDefault()
              const touch = e.touches[0]
              const canvas = selectionCanvasRef.current
              const rect = canvas.getBoundingClientRect()
              const x = touch.clientX - rect.left
              const y = touch.clientY - rect.top
              hookStartSelection(canvas, x, y)
            }}
            onTouchMove={(e) => {
              if (!isSelecting || !isSelectionMode || !selectionCanvasRef.current) return
              e.preventDefault()
              const touch = e.touches[0]
              const canvas = selectionCanvasRef.current
              const rect = canvas.getBoundingClientRect()
              const x = touch.clientX - rect.left
              const y = touch.clientY - rect.top
              hookUpdateSelection(canvas, x, y)
            }}
            onTouchEnd={(e) => {
              if (!isSelectionMode || !canvasRef.current || !drawingCanvasRef.current) return
              e.preventDefault()
              hookFinishSelection(canvasRef.current, drawingCanvasRef.current, zoom, panOffset, RENDER_SCALE, selectionCanvasRef.current)
            }}
          />
          
          {/* 消しゴムの範囲表示（半透明円） */}
          {isEraserMode && eraserCursorPos && (
            <div
              style={{
                position: 'absolute',
                left: `${eraserCursorPos.x}px`,
                top: `${eraserCursorPos.y}px`,
                width: `${eraserSize * 2 * zoom}px`,
                height: `${eraserSize * 2 * zoom}px`,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 100, 100, 0.2)',
                border: '2px solid rgba(255, 100, 100, 0.6)',
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000
              }}
            />
          )}
        </div>

        {/* ページナビゲーション（右端） */}
        {numPages > 1 && (
          <div className="page-scrollbar-container">
            {/* 前のページボタン */}
            <button
              className="page-nav-button"
              onClick={handleGoToPrevPage}
              disabled={pageNum <= 1}
              title="前のページ"
            >
              ▲
            </button>

            {/* ページインジケーター */}
            <div className="page-indicator">
              {pageNum}/{numPages}
            </div>

            {/* 次のページボタン */}
            <button
              className="page-nav-button"
              onClick={handleGoToNextPage}
              disabled={pageNum >= numPages}
              title="次のページ"
            >
              ▼
            </button>
          </div>
        )}
      </div>

      {gradingResult && (
        <GradingResult
          result={gradingResult}
          onClose={() => setGradingResult(null)}
          snsLinks={snsLinks}
          timeLimitMinutes={snsTimeLimit}
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
    </div>
    </div>
  )
}

export default PDFViewer
