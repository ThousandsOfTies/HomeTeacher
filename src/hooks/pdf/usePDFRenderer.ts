import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFFileRecord } from '../../utils/indexedDB'

// PDF.jsのworkerを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface UsePDFRendererOptions {
  onLoadStart?: () => void
  onLoadSuccess?: (numPages: number) => void
  onLoadError?: (error: string) => void
}

export const usePDFRenderer = (
  pdfRecord: PDFFileRecord,
  containerRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options?: UsePDFRendererOptions
) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // optionsをrefで保持して依存配列の問題を回避
  const optionsRef = useRef(options)
  optionsRef.current = options

  // PDFを読み込む
  useEffect(() => {
    const loadPDF = async () => {
      setIsLoading(true)
      setError(null)
      try {
        let pdfData: ArrayBuffer | Uint8Array

        if (pdfRecord.fileData) {
          optionsRef.current?.onLoadStart?.()

          // BlobをArrayBufferに変換（v6から）
          if (pdfRecord.fileData instanceof Blob) {
            pdfData = await pdfRecord.fileData.arrayBuffer()
          } else {
            // 後方互換性: 文字列（Base64）の場合
            const binaryString = atob(pdfRecord.fileData as string)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            pdfData = bytes
          }
        } else {
          const errorMsg =
            'PDFデータが見つかりません。\n\n' +
            '以下の手順で再度ファイルを追加してください：\n' +
            '1. 管理画面に戻る（🏠ボタン）\n' +
            '2. このPDFを削除\n' +
            '3. PDFを再度追加'
          setError(errorMsg)
          optionsRef.current?.onLoadError?.(errorMsg)
          setIsLoading(false)
          return
        }

        console.log('PDFを読み込み中...')
        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        
        // 保存されている最後のページ番号を復元
        if (pdfRecord.lastPageNumber && pdfRecord.lastPageNumber <= pdf.numPages) {
          setPageNum(pdfRecord.lastPageNumber)
          console.log(`📖 前回のページ (${pdfRecord.lastPageNumber}) を復元しました`)
        } else {
          setPageNum(1)
        }
        
        setIsLoading(false)
        optionsRef.current?.onLoadSuccess?.(pdf.numPages)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('PDF読み込みエラー:', errorMsg)
        const fullErrorMsg = 'PDFの読み込みに失敗しました: ' + errorMsg
        setError(fullErrorMsg)
        optionsRef.current?.onLoadError?.(fullErrorMsg)
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfRecord])

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
    goToNextPage
  }
}
