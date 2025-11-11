import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFFileRecord } from '../../utils/indexedDB'

// PDF.jsのworkerを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export const usePDFRenderer = (
  pdfRecord: PDFFileRecord,
  containerRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>
) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const renderTaskRef = useRef<any>(null)

  // PDFを読み込む
  useEffect(() => {
    const loadPDF = async () => {
      setIsLoading(true)
      setError(null)
      try {
        let pdfData: ArrayBuffer | string

        if (pdfRecord.fileData) {
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

        const loadingTask = pdfjsLib.getDocument(pdfData)
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setIsLoading(false)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('PDF読み込みエラー:', errorMsg)
        setError('PDFの読み込みに失敗しました: ' + errorMsg)
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfRecord])

  // ページをレンダリング
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return

    const renderPage = async () => {
      // 前回のレンダリングタスクをキャンセル
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }

      const page = await pdfDoc.getPage(pageNum)

      // 初回ロード時は自動的にフィットするスケールを計算
      let renderScale = 1
      if (isInitialLoad) {
        const viewport = page.getViewport({ scale: 1, rotation: 0 })
        const container = containerRef.current!

        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight

        const scaleX = containerWidth / viewport.width
        const scaleY = containerHeight / viewport.height
        const fitScale = Math.min(scaleX, scaleY) * 0.9

        renderScale = fitScale
        setIsInitialLoad(false)
      }

      return { page, renderScale }
    }

    renderPage()

    // クリーンアップ
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNum, containerRef, canvasRef, isInitialLoad])

  const goToPrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1)
    }
  }

  const goToNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1)
    }
  }

  return {
    pdfDoc,
    pageNum,
    setPageNum,
    numPages,
    isLoading,
    error,
    goToPrevPage,
    goToNextPage,
    renderTaskRef
  }
}
